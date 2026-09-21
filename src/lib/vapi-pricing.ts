import {
  BusinessEntitlementRow,
  resolveEffectiveTier,
} from "@/lib/entitlements";

/** RecoverPe's all-in cost to VAPI / telephony providers. */
export const VAPI_BASE_COST_PER_MINUTE_INR = 20;

/** Target gross margin on AI voice usage. */
export const VAPI_VOICE_MARGIN_RATE = 0.3;

/** Customer-facing rate: ₹20/min cost + 30% margin = ₹26/min. */
export const VAPI_CUSTOMER_RATE_PER_MINUTE_INR =
  VAPI_BASE_COST_PER_MINUTE_INR * (1 + VAPI_VOICE_MARGIN_RATE);

export const PREMIUM_VAPI_TRIAL_MINUTES = 10;

export const ADMIN_GRANTED_SUBSCRIPTION_ID = "admin_granted";

export interface VapiCallBill {
  duration_seconds: number;
  customer_charge_inr: number;
  provider_cost_inr: number;
  margin_inr: number;
}

export interface VapiBillSplit {
  trial_minutes_applied: number;
  wallet_charge_inr: number;
  customer_charge_inr: number;
}

function roundInr(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateVapiCallBill(durationSeconds: number): VapiCallBill {
  const duration_seconds = Math.max(0, durationSeconds);
  const minutes = duration_seconds / 60;
  const customer_charge_inr = roundInr(minutes * VAPI_CUSTOMER_RATE_PER_MINUTE_INR);
  const provider_cost_inr = roundInr(minutes * VAPI_BASE_COST_PER_MINUTE_INR);
  const margin_inr = roundInr(customer_charge_inr - provider_cost_inr);

  return {
    duration_seconds,
    customer_charge_inr,
    provider_cost_inr,
    margin_inr,
  };
}

export function getPremiumTrialMinutesRemaining(input: {
  subscription_tier?: BusinessEntitlementRow["subscription_tier"];
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
  subscription_billing_tier?: BusinessEntitlementRow["subscription_billing_tier"];
  razorpay_subscription_id?: string | null;
  usage_vapi_minutes?: number;
}): number {
  const entitlementRow: BusinessEntitlementRow = {
    subscription_tier: input.subscription_tier ?? "starter",
    subscription_status: input.subscription_status,
    subscription_expires_at: input.subscription_expires_at,
    subscription_billing_tier: input.subscription_billing_tier,
    razorpay_subscription_id: input.razorpay_subscription_id,
  };

  if (resolveEffectiveTier(entitlementRow) !== "premium") {
    return 0;
  }

  const usedMinutes = Math.max(0, Number(input.usage_vapi_minutes ?? 0));
  return Math.max(0, PREMIUM_VAPI_TRIAL_MINUTES - usedMinutes);
}

export function splitVapiBillAcrossTrialAndWallet(
  bill: VapiCallBill,
  trialMinutesRemaining: number
): VapiBillSplit {
  if (bill.customer_charge_inr <= 0) {
    return {
      trial_minutes_applied: 0,
      wallet_charge_inr: 0,
      customer_charge_inr: 0,
    };
  }

  const billedMinutes = bill.duration_seconds / 60;
  const trialMinutesApplied = Math.min(
    Math.max(0, trialMinutesRemaining),
    billedMinutes
  );
  const walletMinutes = Math.max(0, billedMinutes - trialMinutesApplied);
  const wallet_charge_inr = roundInr(
    walletMinutes * VAPI_CUSTOMER_RATE_PER_MINUTE_INR
  );

  return {
    trial_minutes_applied: roundInr(trialMinutesApplied),
    wallet_charge_inr,
    customer_charge_inr: bill.customer_charge_inr,
  };
}

export function canInitiateVapiCall(input: {
  wallet_balance_inr: number;
  trial_minutes_remaining: number;
}): boolean {
  if (input.trial_minutes_remaining > 0) {
    return true;
  }

  return input.wallet_balance_inr > 0;
}

export function vapiCallBlockedMessage(): string {
  return "Your AI Voice Wallet is empty and your Premium trial minutes are used up. Recharge the wallet to continue outbound calls.";
}
