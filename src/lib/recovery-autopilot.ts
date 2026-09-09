import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  AutopilotBusinessContext,
  AutopilotLedgerContext,
  CadenceRun,
  isMonetizationStep,
  resolveAutopilotSchedule,
  resolveAutopilotTone,
} from "@/lib/autopilot-schedule";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { dispatchOmnichannelMessage } from "@/lib/notifications/dispatcher";
import { getTraiCurfewMessage, isTraiCurfewActive } from "@/lib/trai-curfew";
import { parseDateOnly, RECOVERPE_TIMEZONE } from "@/lib/timezone";
import { SubscriptionPlan } from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";

const AUTOPILOT_RUN_HOUR_IST = 9;

export interface ProcessAutopilotRunResult {
  cadence_run_id: string;
  ledger_id: string;
  step_index: number;
  status: "completed" | "halted" | "skipped_curfew" | "skipped_idempotent" | "failed";
  message?: string;
  monetization_flagged?: boolean;
  reminder_sent?: boolean;
}

type DueCadenceRunRow = CadenceRun & {
  ledgers: AutopilotLedgerContext | AutopilotLedgerContext[] | null;
};

function unwrapRelation<T>(value: T | T[] | null): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function computeNextRunAt(dueDate: string, dayOffset: number): string {
  const due = parseDateOnly(dueDate);
  const targetDate = addDays(due, dayOffset);
  const dateLabel = formatInTimeZone(targetDate, RECOVERPE_TIMEZONE, "yyyy-MM-dd");

  return `${dateLabel}T${String(AUTOPILOT_RUN_HOUR_IST).padStart(2, "0")}:00:00+05:30`;
}

export async function haltAutopilotForLedger(
  supabase: SupabaseClient,
  ledgerId: string
): Promise<void> {
  const { error } = await supabase
    .from("cadence_runs")
    .update({ status: "halted" })
    .eq("ledger_id", ledgerId)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message || "Failed to halt autopilot cadence.");
  }
}

async function claimCadenceRun(
  supabase: SupabaseClient,
  cadenceRunId: string
): Promise<CadenceRun | null> {
  const { data, error } = await supabase
    .from("cadence_runs")
    .update({ status: "completed" })
    .eq("id", cadenceRunId)
    .eq("status", "pending")
    .select("id, ledger_id, step_index, next_run_at, status, created_at")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to claim cadence run.");
  }

  return (data as CadenceRun | null) ?? null;
}

async function scheduleCadenceStep(
  supabase: SupabaseClient,
  ledgerId: string,
  stepIndex: number,
  nextRunAt: string
): Promise<void> {
  const { error } = await supabase.from("cadence_runs").insert({
    ledger_id: ledgerId,
    step_index: stepIndex,
    next_run_at: nextRunAt,
    status: "pending",
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message || "Failed to schedule cadence step.");
  }
}

export async function enrollLedgerInAutopilot(
  supabase: SupabaseClient,
  ledger: AutopilotLedgerContext,
  schedule: number[]
): Promise<void> {
  if (!ledger.communication_autopilot) {
    return;
  }

  if (ledger.balance_due <= 0 || ledger.status === "paid") {
    return;
  }

  const nextRunAt = computeNextRunAt(ledger.due_date, schedule[0] ?? 0);

  await scheduleCadenceStep(supabase, ledger.id, 0, nextRunAt);
}

export async function syncAutopilotEnrollments(
  supabase: SupabaseClient,
  limit = 100
): Promise<number> {
  const { data, error } = await supabase
    .from("ledgers")
    .select(
      `
      id,
      user_id,
      contact_id,
      business_id,
      due_date,
      balance_due,
      status,
      communication_paused,
      communication_autopilot,
      legal_escalation_ready
    `
    )
    .eq("communication_autopilot", true)
    .eq("communication_paused", false)
    .gt("balance_due", 0)
    .not("status", "in", '("paid","cancelled","refunded")')
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to sync autopilot enrollments.");
  }

  let enrolled = 0;

  for (const ledger of (data ?? []) as AutopilotLedgerContext[]) {
    const { count, error: countError } = await supabase
      .from("cadence_runs")
      .select("id", { count: "exact", head: true })
      .eq("ledger_id", ledger.id);

    if (countError) {
      throw new Error(countError.message || "Failed to inspect cadence runs.");
    }

    if ((count ?? 0) > 0) {
      continue;
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("subscription_plan")
      .eq("id", ledger.user_id)
      .maybeSingle();

    let business: AutopilotBusinessContext | null = null;

    if (ledger.business_id) {
      const { data: businessRow } = await supabase
        .from("businesses")
        .select("id, business_name, autopilot_schedule")
        .eq("id", ledger.business_id)
        .maybeSingle();

      if (businessRow) {
        business = {
          id: businessRow.id as string,
          business_name: businessRow.business_name as string,
          autopilot_schedule: businessRow.autopilot_schedule as number[],
        };
      }
    }

    const schedule = resolveAutopilotSchedule(
      (userRow?.subscription_plan as SubscriptionPlan | undefined) ?? "free",
      business
    );

    await enrollLedgerInAutopilot(supabase, ledger, schedule);
    enrolled += 1;
  }

  return enrolled;
}

export async function fetchDueCadenceRuns(
  supabase: SupabaseClient,
  limit: number
): Promise<Array<CadenceRun & { ledger: AutopilotLedgerContext }>> {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("cadence_runs")
    .select(
      `
      id,
      ledger_id,
      step_index,
      next_run_at,
      status,
      created_at,
      ledgers (
        id,
        user_id,
        contact_id,
        business_id,
        due_date,
        balance_due,
        status,
        communication_paused,
        communication_autopilot,
        legal_escalation_ready
      )
    `
    )
    .eq("status", "pending")
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to fetch due cadence runs.");
  }

  const rows: Array<CadenceRun & { ledger: AutopilotLedgerContext }> = [];

  for (const row of (data ?? []) as DueCadenceRunRow[]) {
    const ledger = unwrapRelation(row.ledgers);

    if (!ledger) {
      continue;
    }

    rows.push({
      id: row.id,
      ledger_id: row.ledger_id,
      step_index: row.step_index,
      next_run_at: row.next_run_at,
      status: row.status,
      created_at: row.created_at,
      ledger,
    });
  }

  return rows;
}

export async function processAutopilotRun(
  supabase: SupabaseClient,
  input: {
    cadenceRun: CadenceRun;
    ledger: AutopilotLedgerContext;
    business: AutopilotBusinessContext | null;
    subscriptionPlan: SubscriptionPlan;
  }
): Promise<ProcessAutopilotRunResult> {
  const { cadenceRun, ledger, business, subscriptionPlan } = input;
  const schedule = resolveAutopilotSchedule(subscriptionPlan, business);

  if (
    ledger.status === "paid" ||
    ledger.balance_due <= 0 ||
    ledger.communication_paused ||
    !ledger.communication_autopilot
  ) {
    await haltAutopilotForLedger(supabase, ledger.id);
    await supabase
      .from("cadence_runs")
      .update({ status: "halted" })
      .eq("id", cadenceRun.id)
      .eq("status", "pending");

    return {
      cadence_run_id: cadenceRun.id,
      ledger_id: ledger.id,
      step_index: cadenceRun.step_index,
      status: "halted",
      message: "Autopilot halted — ledger paid, paused, or opted out.",
    };
  }

  if (isTraiCurfewActive()) {
    return {
      cadence_run_id: cadenceRun.id,
      ledger_id: ledger.id,
      step_index: cadenceRun.step_index,
      status: "skipped_curfew",
      message: getTraiCurfewMessage(),
    };
  }

  const claimed = await claimCadenceRun(supabase, cadenceRun.id);

  if (!claimed) {
    return {
      cadence_run_id: cadenceRun.id,
      ledger_id: ledger.id,
      step_index: cadenceRun.step_index,
      status: "skipped_idempotent",
      message: "Cadence run already processed.",
    };
  }

  if (isMonetizationStep(cadenceRun.step_index, schedule)) {
    const { error: flagError } = await supabase
      .from("ledgers")
      .update({ legal_escalation_ready: true })
      .eq("id", ledger.id);

    if (flagError) {
      throw new Error(flagError.message || "Failed to flag legal escalation.");
    }

    return {
      cadence_run_id: cadenceRun.id,
      ledger_id: ledger.id,
      step_index: cadenceRun.step_index,
      status: "completed",
      monetization_flagged: true,
      message: "Final autopilot cadence complete — legal escalation ready.",
    };
  }

  const ledgerWithContact = await fetchLedgerById(
    supabase,
    ledger.user_id,
    ledger.id
  );

  if (!ledgerWithContact) {
    return {
      cadence_run_id: cadenceRun.id,
      ledger_id: ledger.id,
      step_index: cadenceRun.step_index,
      status: "failed",
      message: "Ledger not found.",
    };
  }

  const tone = resolveAutopilotTone(cadenceRun.step_index);

  const dispatchResult = await dispatchOmnichannelMessage({
    supabase,
    userId: ledger.user_id,
    businessId: ledger.business_id,
    contactId: ledger.contact_id,
    ledgerId: ledger.id,
    messagePayload: {
      subscriptionPlan,
      autopilotStep: cadenceRun.step_index,
      autopilotTone: tone,
    },
  });

  if (!dispatchResult.success) {
    await supabase
      .from("cadence_runs")
      .update({ status: "pending" })
      .eq("id", cadenceRun.id);

    return {
      cadence_run_id: cadenceRun.id,
      ledger_id: ledger.id,
      step_index: cadenceRun.step_index,
      status: "failed",
      message: dispatchResult.message,
    };
  }

  const nextStepIndex = cadenceRun.step_index + 1;

  if (nextStepIndex < schedule.length) {
    const nextRunAt = computeNextRunAt(ledger.due_date, schedule[nextStepIndex]);
    await scheduleCadenceStep(supabase, ledger.id, nextStepIndex, nextRunAt);
  } else {
    await scheduleCadenceStep(
      supabase,
      ledger.id,
      schedule.length,
      new Date().toISOString()
    );
  }

  return {
    cadence_run_id: cadenceRun.id,
    ledger_id: ledger.id,
    step_index: cadenceRun.step_index,
    status: "completed",
    reminder_sent: true,
    message: dispatchResult.message,
  };
}
