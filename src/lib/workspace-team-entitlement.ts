import { SupabaseClient } from "@supabase/supabase-js";
import { hasEntitlement } from "@/lib/entitlements";

export async function workspaceHasTeamManagementEntitlement(
  supabase: SupabaseClient,
  workspaceUserId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("businesses")
    .select("subscription_tier, subscription_status, addons")
    .eq("user_id", workspaceUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return hasEntitlement(
    {
      subscription_tier: data.subscription_tier,
      subscription_status: data.subscription_status,
      addons: data.addons,
    },
    "team_management"
  );
}
