import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { deriveDisplayName } from "@/lib/admin-users";
import { AdminMetricsResponse, AdminRecentUser } from "@/types";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "authenticated",
  "created",
  "halted",
]);

function monthlyRevenueInr(input: {
  subscription_tier: string | null;
  subscription_interval: string | null;
  subscription_status: string | null;
}): number {
  if (!input.subscription_status || !ACTIVE_SUBSCRIPTION_STATUSES.has(input.subscription_status)) {
    return 0;
  }

  const isAnnual = input.subscription_interval === "annual";

  switch (input.subscription_tier) {
    case "business":
      return isAnnual ? 9999 / 12 : 999;
    case "premium":
      return isAnnual ? 17999 / 12 : 1999;
    default:
      return 0;
  }
}

function sumNumericField(rows: Array<Record<string, unknown>>, field: string): number {
  return rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0);
}

export async function fetchAdminPlatformMetrics(): Promise<AdminMetricsResponse> {
  const supabase = createAdminSupabaseClient();

  const [
    usersCountResult,
    businessesCountResult,
    premiumCountResult,
    ledgersCountResult,
    recentUsersResult,
    businessRowsResult,
    ledgerDebtResult,
    khataBusinessesResult,
    khataPendingResult,
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase.from("businesses").select("id", { count: "exact", head: true }),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("subscription_plan", "premium"),
    supabase.from("ledgers").select("id", { count: "exact", head: true }),
    supabase
      .from("users")
      .select("id, email, subscription_plan, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("businesses")
      .select(
        "subscription_tier, subscription_interval, subscription_status, total_volume_collected_inr"
      ),
    supabase
      .from("ledgers")
      .select("balance_due")
      .gt("balance_due", 0),
    supabase
      .from("businesses")
      .select("id")
      .eq("khata_auto_approve", true),
    supabase.from("pending_onboards").select("business_id"),
  ]);

  if (usersCountResult.error) {
    throw new Error(usersCountResult.error.message || "Failed to count users.");
  }

  if (businessesCountResult.error) {
    throw new Error(
      businessesCountResult.error.message || "Failed to count business profiles."
    );
  }

  if (premiumCountResult.error) {
    throw new Error(
      premiumCountResult.error.message || "Failed to count premium subscriptions."
    );
  }

  if (ledgersCountResult.error) {
    throw new Error(ledgersCountResult.error.message || "Failed to count ledgers.");
  }

  if (recentUsersResult.error) {
    throw new Error(
      recentUsersResult.error.message || "Failed to load recent users."
    );
  }

  const businessRows = businessRowsResult.data ?? [];
  const tierStarterCount = businessRows.filter(
    (row) => (row.subscription_tier as string | null) === "starter" || !row.subscription_tier
  ).length;
  const tierBusinessCount = businessRows.filter(
    (row) => row.subscription_tier === "business"
  ).length;
  const tierPremiumCount = businessRows.filter(
    (row) => row.subscription_tier === "premium"
  ).length;

  const mrrInr = businessRows.reduce((sum, row) => {
    return (
      sum +
      monthlyRevenueInr({
        subscription_tier: row.subscription_tier as string | null,
        subscription_interval: row.subscription_interval as string | null,
        subscription_status: row.subscription_status as string | null,
      })
    );
  }, 0);

  const totalSmartCollectCollectedInr = sumNumericField(
    businessRows as Array<Record<string, unknown>>,
    "total_volume_collected_inr"
  );

  const totalDebtUnderRecoveryInr = sumNumericField(
    (ledgerDebtResult.data ?? []) as Array<Record<string, unknown>>,
    "balance_due"
  );

  const khataMerchantIds = new Set<string>();
  for (const row of khataBusinessesResult.data ?? []) {
    khataMerchantIds.add(row.id as string);
  }
  for (const row of khataPendingResult.data ?? []) {
    if (row.business_id) {
      khataMerchantIds.add(row.business_id as string);
    }
  }

  const platformRecoveryRatePercent =
    totalDebtUnderRecoveryInr > 0
      ? (totalSmartCollectCollectedInr / totalDebtUnderRecoveryInr) * 100
      : 0;

  const recent_users: AdminRecentUser[] = (recentUsersResult.data ?? []).map(
    (user) => ({
      id: user.id as string,
      name: deriveDisplayName(user.email as string),
      email: user.email as string,
      subscription_plan: user.subscription_plan as AdminRecentUser["subscription_plan"],
      created_at: user.created_at as string,
    })
  );

  return {
    metrics: {
      total_registered_users: usersCountResult.count ?? 0,
      total_business_profiles: businessesCountResult.count ?? 0,
      total_premium_subscriptions: premiumCountResult.count ?? 0,
      total_ledgers: ledgersCountResult.count ?? 0,
      mrr_inr: Math.round(mrrInr),
      arr_inr: Math.round(mrrInr * 12),
      tier_starter_count: tierStarterCount,
      tier_business_count: tierBusinessCount,
      tier_premium_count: tierPremiumCount,
      total_debt_under_recovery_inr: Math.round(totalDebtUnderRecoveryInr),
      total_smart_collect_collected_inr: Math.round(totalSmartCollectCollectedInr),
      platform_recovery_rate_percent: Number(platformRecoveryRatePercent.toFixed(1)),
      active_khata_merchants: khataMerchantIds.size,
    },
    recent_users,
  };
}
