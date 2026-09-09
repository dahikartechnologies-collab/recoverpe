import {
  CronLedgerTarget,
  fetchCronReminderTargets,
} from "@/lib/cron/daily-runner";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { dispatchOmnichannelMessage } from "@/lib/notifications/dispatcher";
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

  const { data, error } = await supabase
    .from("communication_logs")
    .select("id")
    .eq("ledger_id", ledgerId)
    .in("type", ["whatsapp_reminder", "email_reminder", "email_invoice"])
    .gte("executed_at", startIso)
    .lte("executed_at", endIso)
    .limit(1);

  if (error) {
    throw new Error(
      error.message || "Failed to check reminder idempotency."
    );
  }

  return (data?.length ?? 0) > 0;
}

export async function processCronReminderTargets(
  supabase: SupabaseClient,
  targets: CronLedgerTarget[],
  referenceDate: string
): Promise<CronReminderSendResult[]> {
  if (isTraiCurfewActive()) {
    const curfewMessage = getTraiCurfewMessage();

    return targets.map((target) => ({
      ledger_id: target.ledger_id,
      cadence: target.cadence,
      status: "skipped_curfew" as const,
      message: curfewMessage,
    }));
  }

  const results: CronReminderSendResult[] = [];

  for (const target of targets) {
    try {
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

      const dispatchResult = await dispatchOmnichannelMessage({
        supabase,
        userId: target.user_id,
        businessId: ledger.business_id,
        contactId: ledger.contact_id,
        ledgerId: ledger.id,
        messagePayload: {
          subscriptionPlan: target.subscription_plan,
        },
      });

      if (!dispatchResult.success) {
        results.push({
          ledger_id: target.ledger_id,
          cadence: target.cadence,
          status: "failed",
          message: dispatchResult.message,
        });
        continue;
      }

      results.push({
        ledger_id: target.ledger_id,
        cadence: target.cadence,
        status: "sent",
        simulated: dispatchResult.simulated,
        channel: dispatchResult.channel,
        fallbackTriggered: dispatchResult.fallbackTriggered,
        message: dispatchResult.message,
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
  referenceDate: string
): Promise<{
  targets: CronLedgerTarget[];
  results: CronReminderSendResult[];
}> {
  const targets = await fetchCronReminderTargets(supabase, referenceDate);
  const results = await processCronReminderTargets(
    supabase,
    targets,
    referenceDate
  );

  return { targets, results };
}
