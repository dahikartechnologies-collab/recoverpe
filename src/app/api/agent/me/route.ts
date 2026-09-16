import { NextResponse } from "next/server";
import { computeAgentAnalytics } from "@/lib/agent/analytics";
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

  const [{ data: referrals, error }, { data: profile, error: profileError }, analytics] =
    await Promise.all([
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
          "bank_account_name, bank_account_number, bank_ifsc, kyc_document_url"
        )
        .eq("id", agent.agentId)
        .single(),
      computeAgentAnalytics(supabase, agent.agentId, agent.walletLiabilityInr),
    ]);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load referrals." },
      { status: 500 }
    );
  }

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message || "Failed to load agent profile." },
      { status: 500 }
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
      kyc_documents: kycDocuments,
    },
    analytics,
    referrals: referrals ?? [],
  });
}
