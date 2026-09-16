import { NextResponse } from "next/server";
import {
  countOpenCashTickets,
  isAgentReferralFrozen,
} from "@/lib/agent/cash-protocol";
import { requireActiveAgent } from "@/lib/agent/auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const agent = await requireActiveAgent(request);

  if ("error" in agent) {
    return agent.error;
  }

  const supabase = createAdminSupabaseClient();
  const openCashTickets = await countOpenCashTickets(supabase, agent.agentId);
  const frozen = isAgentReferralFrozen({
    walletLiabilityInr: agent.walletLiabilityInr,
    openCashTickets,
  });

  const { data: referrals, error } = await supabase
    .from("agent_referrals")
    .select(
      "id, merchant_phone, business_name, discount_bps, status, activated_at, created_at"
    )
    .eq("agent_id", agent.agentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load referrals." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    agent: {
      id: agent.agentId,
      display_name: agent.displayName,
      status: agent.status,
      referral_code: agent.referralCode,
      discount_cap_bps: agent.discountCapBps,
      wallet_liability_inr: agent.walletLiabilityInr,
      open_cash_tickets: openCashTickets,
      referrals_frozen: frozen,
    },
    referrals: referrals ?? [],
  });
}
