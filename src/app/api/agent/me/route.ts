import { NextResponse } from "next/server";
import { computeAgentAnalytics, createFallbackAgentAnalytics } from "@/lib/agent/analytics";
import {
  countOpenCashTickets,
  isAgentReferralFrozen,
} from "@/lib/agent/cash-protocol";
import { requireActiveAgent } from "@/lib/agent/auth";
import { parseAgentKycDocuments } from "@/lib/agent/kyc-storage";
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

  const [
    { data: referrals, error: referralsError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    supabase
      .from("agent_referrals")
      .select(
        "id, merchant_phone, business_name, discount_bps, status, activated_at, created_at"
      )
      .eq("agent_id", agent.agentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("agents")
      .select(
        "bank_account_name, bank_account_number, bank_ifsc, kyc_document_url, pan_number, pan_verified_at, bank_verified_at, kyc_verified_at"
      )
      .eq("id", agent.agentId)
      .single(),
  ]);

  if (referralsError) {
    console.error("[agent/me] referrals fallback", referralsError);
  }

  if (profileError) {
    console.error("[agent/me] profile fallback", profileError);
  }

  let analytics;

  try {
    analytics = await computeAgentAnalytics(
      supabase,
      agent.agentId,
      agent.walletLiabilityInr,
      agent.discountCapBps
    );
  } catch (analyticsError) {
    console.error("[agent/me] analytics fallback", analyticsError);
    analytics = createFallbackAgentAnalytics(
      agent.discountCapBps,
      agent.walletLiabilityInr
    );
  }

  const kycDocuments = parseAgentKycDocuments(
    profile?.kyc_document_url as string | null | undefined
  );

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
      bank_account_name: profile?.bank_account_name ?? null,
      bank_account_number: profile?.bank_account_number ?? null,
      bank_ifsc: profile?.bank_ifsc ?? null,
      pan_number: profile?.pan_number ?? null,
      pan_verified_at: profile?.pan_verified_at ?? null,
      bank_verified_at: profile?.bank_verified_at ?? null,
      kyc_verified_at: profile?.kyc_verified_at ?? null,
      kyc_documents: kycDocuments,
    },
    analytics,
    referrals: referrals ?? [],
  });
}
