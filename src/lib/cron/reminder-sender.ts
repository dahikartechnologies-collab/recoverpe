import { fetchBusinessAutomationSettings } from "@/lib/automation-settings-server";
import { hasReminderInWindow } from "@/lib/communication-logs";
import {
  CronLedgerTarget,
  fetchCronReminderTargets,
} from "@/lib/cron/daily-runner";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { dispatchDebtReminder } from "@/lib/notifications/omnichannel-dispatcher";
import { getIstDayBounds } from "@/lib/timezone";
import { getTraiCurfewMessage, isTraiCurfewActive } from "@/lib/trai-curfew";
import { SupabaseClient } from "@supabase/supabase-js";

export interface CronReminderSendResult {
  ledger_id: string;
  cadence: CronLedgerTarget["cadence"];
  status:
    | "sent"
    | "skipped_idempotent"
    | "skipped_missing_ledger"
    | "skipped_curfew"
    | "skipped_disabled"
    | "failed";
  message?: string;
  simulated?: boolean;
  channel?: "whatsapp" | "email";
  fallbackTriggered?: boolean;
}

async function wasReminderSentToday(
  supabase: SupabaseClient,
  ledgerId: string,
  referenceDate: string
): Promise<boolean> {
  const { startIso, endIso } = getIstDayBounds(referenceDate);

  return hasReminderInWindow(supabase, {
    ledgerIds: [ledgerId],
    types: ["whatsapp_reminder", "email_reminder", "email_invoice", "sms_reminder"],
    startIso,
    endIso,
  });
}

async function isRecoveryAutopilotEnabled(
  supabase: SupabaseClient,
  businessId: string | null,
  cache: Map<string, boolean>
): Promise<boolean> {
  if (!businessId) {
    return true;
  }

  const cached = cache.get(businessId);

  if (cached !== undefined) {
    return cached;
  }

  const settings = await fetchBusinessAutomationSettings(supabase, businessId);
  cache.set(businessId, settings.recovery_autopilot);

  return settings.recovery_autopilot;
}

export async function processCronReminderTargets(
  supabase: SupabaseClient,
  targets: CronLedgerTarget[],
  referenceDate: string,
  options: { bypassCurfew?: boolean } = {}
): Promise<CronReminderSendResult[]> {
  if (!options.bypassCurfew && isTraiCurfewActive()) {
    const curfewMessage = getTraiCurfewMessage();

    return targets.map((target) => ({
      ledger_id: target.ledger_id,
      cadence: target.cadence,
      status: "skipped_curfew" as const,
      message: curfewMessage,
    }));
  }

  const results: CronReminderSendResult[] = [];
  const autopilotEnabledByBusiness = new Map<string, boolean>();

  for (const target of targets) {
    try {
      const autopilotEnabled = await isRecoveryAutopilotEnabled(
        supabase,
        target.business_id ?? null,
        autopilotEnabledByBusiness
      );

      if (!autopilotEnabled) {
        results.push({
          ledger_id: target.ledger_id,
          cadence: target.cadence,
          status: "skipped_disabled",
          message: "Recovery Autopilot is turned off for this business.",
        });
        continue;
      }

      const alreadySent = await wasReminderSentToday(
        supabase,
        target.ledger_id,
        referenceDate
      );

      if (alreadySent) {
        results.push({
          ledger_id: target.ledger_id,
          cadence: target.cadence,
          status: "skipped_idempotent",
          message: "Reminder already sent today for this ledger.",
        });
        continue;
      }

      const ledger = await fetchLedgerById(
        supabase,
        target.user_id,
        target.ledger_id
      );

      if (!ledger) {
        results.push({
          ledger_id: target.ledger_id,
          cadence: target.cadence,
          status: "skipped_missing_ledger",
          message: "Ledger not found.",
        });
        continue;
      }

      const dispatchResult = await dispatchDebtReminder(
        supabase,
        ledger.id,
        target.days_from_due > 3 ? "overdue_escalation" : "normal"
      );

      if (!dispatchResult.whatsapp?.success) {
        results.push({
          ledger_id: target.ledger_id,
          cadence: target.cadence,
          status: "failed",
          message: dispatchResult.whatsapp?.message ?? "Reminder dispatch failed.",
        });
        continue;
      }

      results.push({
        ledger_id: target.ledger_id,
        cadence: target.cadence,
        status: "sent",
        simulated: dispatchResult.whatsapp.simulated,
        channel: dispatchResult.whatsapp.channel,
        fallbackTriggered: dispatchResult.whatsapp.fallbackTriggered,
        message: dispatchResult.whatsapp.message,
      });
    } catch (error) {
      results.push({
        ledger_id: target.ledger_id,
        cadence: target.cadence,
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to send cron reminder.",
      });
    }
  }

  return results;
}

export async function runDailyReminderJob(
  supabase: SupabaseClient,
  referenceDate: string,
  options: { bypassCurfew?: boolean } = {}
): Promise<{
  targets: CronLedgerTarget[];
  results: CronReminderSendResult[];
}> {
  const targets = await fetchCronReminderTargets(supabase, referenceDate);
  const results = await processCronReminderTargets(
    supabase,
    targets,
    referenceDate,
    options
  );

  return { targets, results };
}
