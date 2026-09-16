import { SupabaseClient } from "@supabase/supabase-js";
import { IdentitySurfaces } from "@/lib/active-context";
import { AGENT_ACTIVE_STATUSES } from "@/lib/agent/constants";

export async function loadIdentitySurfaces(
  supabase: SupabaseClient,
  userId: string
): Promise<IdentitySurfaces> {
  const [{ count: ownedBusinesses }, { count: memberships }, { data: agent }] =
    await Promise.all([
      supabase
        .from("businesses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("member_user_id", userId)
        .eq("status", "accepted"),
      supabase
        .from("agents")
        .select("id, status")
        .eq("user_id", userId)
        .in("status", [...AGENT_ACTIVE_STATUSES])
        .maybeSingle(),
    ]);

  const hasMerchant = (ownedBusinesses ?? 0) > 0 || (memberships ?? 0) > 0;
  const hasAgent = Boolean(agent?.id);

  // A RecoverPe user without shops or memberships is still a merchant-to-be
  // unless they only exist as a field agent.
  return {
    has_merchant: hasMerchant || !hasAgent,
    has_agent: hasAgent,
  };
}
