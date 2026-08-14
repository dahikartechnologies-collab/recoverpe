import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { deriveDisplayName } from "@/lib/admin-users";
import { AdminMetricsResponse, AdminRecentUser } from "@/types";

export async function fetchAdminPlatformMetrics(): Promise<AdminMetricsResponse> {
  const supabase = createAdminSupabaseClient();

  const [
    usersCountResult,
    businessesCountResult,
    premiumCountResult,
    ledgersCountResult,
    recentUsersResult,
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
    },
    recent_users,
  };
}
