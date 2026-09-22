import {
  fetchDueCadenceRuns,
  ProcessAutopilotRunResult,
  processAutopilotRun,
  syncAutopilotEnrollments,
  getAutopilotContactGroupKey,
  wasContactRemindedToday,
  fetchUnpaidLedgersForContactScope,
  pickPrimaryReminderLedger,
  computeTotalOutstandingBalance,
} from "@/lib/recovery-autopilot";
import { AutopilotBusinessContext } from "@/lib/autopilot-schedule";
import { refreshContactRiskScoreAsync } from "@/lib/contact-risk-score";
import { isLedgerDynamicallyOverdue } from "@/lib/ledger-status";
import { getTodayDateStringInIst } from "@/lib/timezone";
import { BusinessEntitlementRow } from "@/lib/entitlements";
import { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_BATCH_SIZE = 40;
const DEFAULT_TIME_BUDGET_MS = 50_000;

type BusinessRow = AutopilotBusinessContext & BusinessEntitlementRow;

export async function runAutopilotCadenceJob(
  supabase: SupabaseClient,
  options?: {
    batchSize?: number;
    timeBudgetMs?: number;
    referenceDate?: string;
  }
): Promise<{
  enrolled_count: number;
  processed_count: number;
  contact_groups_processed: number;
  batched_skips: number;
  results: ProcessAutopilotRunResult[];
}> {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const timeBudgetMs = options?.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const referenceDate = options?.referenceDate ?? getTodayDateStringInIst();
  const startedAt = Date.now();

  const enrolledCount = await syncAutopilotEnrollments(supabase, batchSize);

  const dueRuns = await fetchDueCadenceRuns(supabase, batchSize);
  const results: ProcessAutopilotRunResult[] = [];

  const businessCache = new Map<string, BusinessRow | null>();

  const groupedRuns = new Map<
    string,
    Awaited<ReturnType<typeof fetchDueCadenceRuns>>
  >();

  for (const dueRun of dueRuns) {
    const groupKey = getAutopilotContactGroupKey(
      dueRun.ledger.contact_id,
      dueRun.ledger.business_id
    );
    const existing = groupedRuns.get(groupKey) ?? [];
    existing.push(dueRun);
    groupedRuns.set(groupKey, existing);
  }

  for (const groupRuns of Array.from(groupedRuns.values())) {
    if (Date.now() - startedAt > timeBudgetMs) {
      break;
    }

    const sampleLedger = groupRuns[0]?.ledger;

    if (!sampleLedger) {
      continue;
    }

    let business: BusinessRow | null = null;

    if (sampleLedger.business_id) {
      if (businessCache.has(sampleLedger.business_id)) {
        business = businessCache.get(sampleLedger.business_id) ?? null;
      } else {
        const { data: businessRow, error: businessError } = await supabase
          .from("businesses")
          .select(
            "id, business_name, autopilot_schedule, subscription_tier, subscription_status, subscription_expires_at, subscription_billing_tier, razorpay_subscription_id, addons"
          )
          .eq("id", sampleLedger.business_id)
          .maybeSingle();

        if (businessError) {
          throw new Error(businessError.message || "Failed to load business profile.");
        }

        business = businessRow
          ? {
              id: businessRow.id as string,
              business_name: businessRow.business_name as string,
              autopilot_schedule: businessRow.autopilot_schedule as number[],
              subscription_tier:
                (businessRow.subscription_tier as BusinessEntitlementRow["subscription_tier"]) ??
                "free",
              subscription_status: businessRow.subscription_status as string | null,
              subscription_expires_at: businessRow.subscription_expires_at as
                | string
                | null,
              subscription_billing_tier: businessRow.subscription_billing_tier as
                | BusinessEntitlementRow["subscription_billing_tier"]
                | null,
              razorpay_subscription_id: businessRow.razorpay_subscription_id as
                | string
                | null,
              addons: businessRow.addons,
            }
          : null;

        businessCache.set(sampleLedger.business_id, business);
      }
    }

    const alreadyReminded = await wasContactRemindedToday(
      supabase,
      sampleLedger.contact_id,
      sampleLedger.business_id,
      referenceDate
    );

    const unpaidLedgers = await fetchUnpaidLedgersForContactScope(
      supabase,
      sampleLedger.contact_id,
      sampleLedger.business_id
    );
    const primaryLedger = pickPrimaryReminderLedger(unpaidLedgers);
    const totalOutstandingBalance = computeTotalOutstandingBalance(unpaidLedgers);

    const dispatchRunId =
      !alreadyReminded && primaryLedger
        ? groupRuns.find(
            (run: (typeof groupRuns)[number]) => run.ledger_id === primaryLedger.id
          )?.id ??
          groupRuns[0]?.id ??
          null
        : null;

    for (const dueRun of groupRuns) {
      if (Date.now() - startedAt > timeBudgetMs) {
        break;
      }

      const ledger = dueRun.ledger;
      const shouldDispatch =
        !alreadyReminded && dispatchRunId !== null && dueRun.id === dispatchRunId;

      try {
        const result = await processAutopilotRun(supabase, {
          cadenceRun: dueRun,
          ledger,
          business,
          skipReminderDispatch: !shouldDispatch,
          totalOutstandingBalance: shouldDispatch
            ? totalOutstandingBalance
            : undefined,
        });

        results.push(result);

        if (isLedgerDynamicallyOverdue(ledger)) {
          refreshContactRiskScoreAsync(supabase, ledger.contact_id);
        }
      } catch (error) {
        results.push({
          cadence_run_id: dueRun.id,
          ledger_id: ledger.id,
          step_index: dueRun.step_index,
          status: "failed",
          message:
            error instanceof Error
              ? error.message
              : "Autopilot run failed unexpectedly.",
        });
      }
    }
  }

  const batchedSkips = results.filter(
    (result) => result.status === "skipped_contact_batch"
  ).length;

  return {
    enrolled_count: enrolledCount,
    processed_count: results.length,
    contact_groups_processed: groupedRuns.size,
    batched_skips: batchedSkips,
    results,
  };
}
