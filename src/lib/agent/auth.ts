import { NextResponse } from "next/server";
import { getActiveContextFromCookieHeader } from "@/lib/active-context";
import { requireActorIdentity } from "@/lib/identity-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { AGENT_ACTIVE_STATUSES } from "@/lib/agent/constants";

export interface AgentAuthContext {
  userId: string;
  agentId: string;
  displayName: string;
  status: string;
  referralCode: string;
  discountCapBps: number;
  walletLiabilityInr: number;
}

export async function requireActiveAgent(
  request: Request
): Promise<AgentAuthContext | { error: NextResponse }> {
  const identity = await requireActorIdentity(request);

  if ("error" in identity) {
    return identity;
  }

  if (identity.isGhostMode) {
    return {
      error: NextResponse.json(
        { error: "Ghost mode cannot open agent payouts." },
        { status: 403 }
      ),
    };
  }

  const context = getActiveContextFromCookieHeader(
    request.headers.get("cookie")
  );

  if (context !== "agent") {
    return {
      error: NextResponse.json(
        { error: "Switch to agent context to continue." },
        { status: 403 }
      ),
    };
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("agents")
    .select(
      "id, display_name, status, referral_code, discount_cap_bps, wallet_liability_inr"
    )
    .eq("user_id", identity.actorUserId)
    .in("status", [...AGENT_ACTIVE_STATUSES])
    .maybeSingle();

  if (error) {
    return {
      error: NextResponse.json(
        { error: error.message || "Failed to load agent profile." },
        { status: 500 }
      ),
    };
  }

  if (!data) {
    return {
      error: NextResponse.json(
        { error: "No active RecoverPe agent profile on this account." },
        { status: 403 }
      ),
    };
  }

  return {
    userId: identity.actorUserId,
    agentId: data.id as string,
    displayName: data.display_name as string,
    status: data.status as string,
    referralCode: data.referral_code as string,
    discountCapBps: Number(data.discount_cap_bps ?? 0),
    walletLiabilityInr: Number(data.wallet_liability_inr ?? 0),
  };
}
