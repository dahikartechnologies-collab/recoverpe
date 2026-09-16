import { SupabaseClient } from "@supabase/supabase-js";
import {
  AGENT_LIABILITY_FREEZE_INR,
  AGENT_MAX_OPEN_CASH_TICKETS,
  AGENT_ONBOARD_PAYOUT_INR,
} from "@/lib/agent/constants";
import { expectedPremiumInr } from "@/lib/agent/otp";

interface AgentRow {
  id: string;
  wallet_liability_inr: number;
  status: string;
}

interface ReferralRow {
  id: string;
  agent_id: string;
  merchant_user_id: string | null;
  merchant_phone: string;
  discount_bps: number;
  status: string;
}

export function isAgentReferralFrozen(input: {
  walletLiabilityInr: number;
  openCashTickets: number;
}): boolean {
  return (
    input.walletLiabilityInr > AGENT_LIABILITY_FREEZE_INR ||
    input.openCashTickets >= AGENT_MAX_OPEN_CASH_TICKETS
  );
}

export async function countOpenCashTickets(
  supabase: SupabaseClient,
  agentId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("agent_cash_collections")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .in("status", ["declared", "merchant_confirmed"]);

  if (error) {
    throw new Error(error.message || "Failed to count open cash tickets.");
  }

  return count ?? 0;
}

/**
 * OPTION A: merchant OTP is consent AND entitlement.
 * Liability still rises until remittance. ₹100 stays accrued until cash lands.
 */
export async function activateReferralAtMerchantOtp(
  supabase: SupabaseClient,
  referral: ReferralRow,
  merchantUserId: string | null
): Promise<void> {
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, wallet_liability_inr, status")
    .eq("id", referral.agent_id)
    .single();

  if (agentError || !agent) {
    throw new Error(agentError?.message || "Agent not found.");
  }

  const agentRow = agent as AgentRow;
  const expectedInr = expectedPremiumInr(referral.discount_bps);
  const nextLiability =
    Number(agentRow.wallet_liability_inr ?? 0) + expectedInr;

  const { error: referralError } = await supabase
    .from("agent_referrals")
    .update({
      status: "activated",
      merchant_user_id: merchantUserId,
      activated_at: new Date().toISOString(),
      merchant_otp_hash: null,
    })
    .eq("id", referral.id)
    .eq("status", "awaiting_merchant_otp");

  if (referralError) {
    throw new Error(referralError.message || "Failed to activate referral.");
  }

  const { error: cashError } = await supabase.from("agent_cash_collections").insert({
    agent_id: referral.agent_id,
    referral_id: referral.id,
    declared_inr: expectedInr,
    expected_inr: expectedInr,
    status: "declared",
    merchant_confirmed_at: new Date().toISOString(),
  });

  if (cashError) {
    throw new Error(cashError.message || "Failed to record cash ticket.");
  }

  const { error: payoutError } = await supabase.from("agent_payouts").insert({
    agent_id: referral.agent_id,
    referral_id: referral.id,
    kind: "onboard_100",
    amount_inr: AGENT_ONBOARD_PAYOUT_INR,
    period_ym: null,
    status: "accrued",
  });

  if (payoutError && !payoutError.message.toLowerCase().includes("duplicate")) {
    throw new Error(payoutError.message || "Failed to accrue onboard payout.");
  }

  const { error: liabilityError } = await supabase
    .from("agents")
    .update({ wallet_liability_inr: nextLiability })
    .eq("id", referral.agent_id);

  if (liabilityError) {
    throw new Error(liabilityError.message || "Failed to increase wallet liability.");
  }

  if (merchantUserId) {
    const { activatePremiumForUser } = await import("@/lib/razorpay");
    await activatePremiumForUser(supabase, merchantUserId, "monthly");
  }
}

export async function remitAgentCashCollection(
  supabase: SupabaseClient,
  cashCollectionId: string
): Promise<void> {
  const { data: cash, error: cashError } = await supabase
    .from("agent_cash_collections")
    .select("id, agent_id, referral_id, expected_inr, status")
    .eq("id", cashCollectionId)
    .single();

  if (cashError || !cash) {
    throw new Error(cashError?.message || "Cash ticket not found.");
  }

  if (cash.status === "remitted") {
    return;
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, wallet_liability_inr")
    .eq("id", cash.agent_id)
    .single();

  if (agentError || !agent) {
    throw new Error(agentError?.message || "Agent not found.");
  }

  const nextLiability = Math.max(
    0,
    Number(agent.wallet_liability_inr ?? 0) - Number(cash.expected_inr ?? 0)
  );

  const { error: updateCashError } = await supabase
    .from("agent_cash_collections")
    .update({
      status: "remitted",
      remitted_at: new Date().toISOString(),
    })
    .eq("id", cashCollectionId);

  if (updateCashError) {
    throw new Error(updateCashError.message || "Failed to mark cash remitted.");
  }

  const { error: liabilityError } = await supabase
    .from("agents")
    .update({ wallet_liability_inr: nextLiability })
    .eq("id", cash.agent_id);

  if (liabilityError) {
    throw new Error(liabilityError.message || "Failed to decrease wallet liability.");
  }

  await supabase
    .from("agent_payouts")
    .update({ status: "approved" })
    .eq("referral_id", cash.referral_id)
    .eq("kind", "onboard_100")
    .eq("status", "accrued");
}

export async function applyPendingAgentPremiumOnSync(
  supabase: SupabaseClient,
  userId: string,
  phoneNumber: string
): Promise<void> {
  const digits = phoneNumber.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  const phones = Array.from(
    new Set(
      [`+91${last10}`, `91${last10}`, last10, phoneNumber].filter(Boolean)
    )
  );

  const { data: referrals, error } = await supabase
    .from("agent_referrals")
    .select("id")
    .in("merchant_phone", phones)
    .eq("status", "activated")
    .is("merchant_user_id", null);

  if (error || !referrals?.length) {
    return;
  }

  await Promise.all(
    referrals.map((row) =>
      supabase
        .from("agent_referrals")
        .update({ merchant_user_id: userId })
        .eq("id", row.id)
    )
  );

  const { activatePremiumForUser } = await import("@/lib/razorpay");
  await activatePremiumForUser(supabase, userId, "monthly");
}
