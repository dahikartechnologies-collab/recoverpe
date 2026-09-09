import {
  fetchDueCadenceRuns,
  ProcessAutopilotRunResult,
  processAutopilotRun,
  syncAutopilotEnrollments,
} from "@/lib/recovery-autopilot";
import { refreshContactRiskScoreAsync } from "@/lib/contact-risk-score";
import { isLedgerDynamicallyOverdue } from "@/lib/ledger-status";
import { SupabaseClient } from "@supabase/supabase-js";
import { SubscriptionPlan } from "@/types";

const DEFAULT_BATCH_SIZE = 40;
const DEFAULT_TIME_BUDGET_MS = 50_000;

type BusinessRow = {
  id: string;
  business_name: string;
  autopilot_schedule: number[];
};

export async function runAutopilotCadenceJob(
  supabase: SupabaseClient,
  options?: {
    batchSize?: number;
    timeBudgetMs?: number;
  }
): Promise<{
  enrolled_count: number;
  processed_count: number;
  results: ProcessAutopilotRunResult[];
}> {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  const timeBudgetMs = options?.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const startedAt = Date.now();

  const enrolledCount = await syncAutopilotEnrollments(supabase, batchSize);

  const dueRuns = await fetchDueCadenceRuns(supabase, batchSize);
  const results: ProcessAutopilotRunResult[] = [];

  const businessCache = new Map<string, BusinessRow | null>();
  const subscriptionCache = new Map<string, SubscriptionPlan>();

  for (const dueRun of dueRuns) {
    if (Date.now() - startedAt > timeBudgetMs) {
      break;
    }

    const ledger = dueRun.ledger;

    let subscriptionPlan = subscriptionCache.get(ledger.user_id);

    if (!subscriptionPlan) {
      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("subscription_plan")
        .eq("id", ledger.user_id)
        .maybeSingle();

      if (userError) {
        throw new Error(userError.message || "Failed to resolve subscription plan.");
      }

      subscriptionPlan = (userRow?.subscription_plan as SubscriptionPlan | undefined) ?? "free";
      subscriptionCache.set(ledger.user_id, subscriptionPlan);
    }

    let business: BusinessRow | null = null;

    if (ledger.business_id) {
      if (businessCache.has(ledger.business_id)) {
        business = businessCache.get(ledger.business_id) ?? null;
      } else {
        const { data: businessRow, error: businessError } = await supabase
          .from("businesses")
          .select("id, business_name, autopilot_schedule")
          .eq("id", ledger.business_id)
          .maybeSingle();

        if (businessError) {
          throw new Error(businessError.message || "Failed to load business profile.");
        }

        business = businessRow
          ? {
              id: businessRow.id as string,
              business_name: businessRow.business_name as string,
              autopilot_schedule: businessRow.autopilot_schedule as number[],
            }
          : null;

        businessCache.set(ledger.business_id, business);
      }
    }

    try {
      const result = await processAutopilotRun(supabase, {
        cadenceRun: dueRun,
        ledger,
        business,
        subscriptionPlan,
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
          error instanceof Error ? error.message : "Autopilot run failed unexpectedly.",
      });
    }
  }

  return {
    enrolled_count: enrolledCount,
    processed_count: results.length,
    results,
  };
}
