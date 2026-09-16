import { SupabaseClient } from "@supabase/supabase-js";
import {
  AGENT_LIABILITY_FREEZE_INR,
  AGENT_MAX_OPEN_CASH_TICKETS,
  AGENT_ONBOARD_PAYOUT_INR,
  AGENT_OTP_MAX_ATTEMPTS,
} from "@/lib/agent/constants";
import { agentOtpMatches, expectedPremiumInr } from "@/lib/agent/otp";
import { buildPhoneLookupCandidates } from "@/lib/whatsapp/inbound-payment-responder";

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

export class AgentReferralOtpError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_found"
      | "expired"
      | "max_attempts"
      | "invalid_otp"
      | "invalid_state"
  ) {
    super(message);
    this.name = "AgentReferralOtpError";
  }
}

/**
 * Agent-entered merchant OTP moves the referral to cash_held so the ticket
 * shows as pending remittance until HQ confirms the cash landed.
 */
export async function confirmReferralOtpByAgent(
  supabase: SupabaseClient,
  agentId: string,
  referralId: string,
  otpCode: string
): Promise<{ status: "cash_held"; expected_inr: number }> {
  const trimmedOtp = otpCode.trim();

  if (!/^\d{6}$/.test(trimmedOtp)) {
    throw new AgentReferralOtpError(
      "Enter the 6-digit OTP the merchant received on WhatsApp.",
      "invalid_otp"
    );
  }

  const { data: referral, error } = await supabase
    .from("agent_referrals")
    .select(
      "id, agent_id, merchant_user_id, merchant_phone, discount_bps, status, merchant_otp_hash, merchant_otp_expires_at, merchant_otp_attempts"
    )
    .eq("id", referralId)
    .eq("agent_id", agentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load referral.");
  }

  if (!referral || referral.status !== "awaiting_merchant_otp") {
    throw new AgentReferralOtpError(
      "This referral is not waiting for an OTP.",
      "invalid_state"
    );
  }

  const expiresAt = referral.merchant_otp_expires_at
    ? new Date(referral.merchant_otp_expires_at as string).getTime()
    : 0;

  if (!expiresAt || expiresAt < Date.now()) {
    await supabase
      .from("agent_referrals")
      .update({ status: "cancelled", merchant_otp_hash: null })
      .eq("id", referral.id)
      .eq("status", "awaiting_merchant_otp");

    throw new AgentReferralOtpError(
      "This OTP has expired. Start a new referral for the merchant.",
      "expired"
    );
  }

  const attempts = Number(referral.merchant_otp_attempts ?? 0);

  if (attempts >= AGENT_OTP_MAX_ATTEMPTS) {
    await supabase
      .from("agent_referrals")
      .update({ status: "cancelled", merchant_otp_hash: null })
      .eq("id", referral.id);

    throw new AgentReferralOtpError(
      "Too many invalid attempts. Start a new referral for this merchant.",
      "max_attempts"
    );
  }

  const storedHash = String(referral.merchant_otp_hash ?? "");

  if (!storedHash || !agentOtpMatches(trimmedOtp, storedHash)) {
    await supabase
      .from("agent_referrals")
      .update({ merchant_otp_attempts: attempts + 1 })
      .eq("id", referral.id);

    throw new AgentReferralOtpError(
      "Incorrect OTP. Ask the merchant to read the WhatsApp code again.",
      "invalid_otp"
    );
  }

  const phones = buildPhoneLookupCandidates(referral.merchant_phone as string);
  const { data: merchant } = await supabase
    .from("users")
    .select("id")
    .in("phone_number", phones)
    .limit(1)
    .maybeSingle();

  const merchantUserId = (merchant?.id as string | undefined) ?? null;
  const expectedInr = expectedPremiumInr(Number(referral.discount_bps ?? 0));

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, wallet_liability_inr")
    .eq("id", agentId)
    .single();

  if (agentError || !agent) {
    throw new Error(agentError?.message || "Agent not found.");
  }

  const nextLiability = Number(agent.wallet_liability_inr ?? 0) + expectedInr;

  const { error: referralError } = await supabase
    .from("agent_referrals")
    .update({
      status: "cash_held",
      merchant_user_id: merchantUserId,
      merchant_otp_hash: null,
      merchant_otp_attempts: 0,
    })
    .eq("id", referral.id)
    .eq("status", "awaiting_merchant_otp");

  if (referralError) {
    throw new Error(referralError.message || "Failed to confirm referral OTP.");
  }

  const { error: cashError } = await supabase.from("agent_cash_collections").insert({
    agent_id: agentId,
    referral_id: referral.id,
    declared_inr: expectedInr,
    expected_inr: expectedInr,
    status: "declared",
  });

  if (cashError) {
    throw new Error(cashError.message || "Failed to record cash ticket.");
  }

  const { error: payoutError } = await supabase.from("agent_payouts").insert({
    agent_id: agentId,
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
    .eq("id", agentId);

  if (liabilityError) {
    throw new Error(liabilityError.message || "Failed to increase wallet liability.");
  }

  return {
    status: "cash_held",
    expected_inr: expectedInr,
  };
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
