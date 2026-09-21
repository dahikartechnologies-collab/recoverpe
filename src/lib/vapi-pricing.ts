import {
  BusinessEntitlementRow,
  PREMIUM_VAPI_TRIAL_MINUTES,
  resolveEffectiveTier,
} from "@/lib/entitlements";
import {
  DEFAULT_PLATFORM_SETTINGS,
  PlatformSettings,
} from "@/lib/platform-settings";

/** @deprecated Use platform_settings.fallback_usd_to_inr via billing engine. */
export const USD_TO_INR = DEFAULT_PLATFORM_SETTINGS.fallback_usd_to_inr;

/** @deprecated Use platform_settings.vapi_margin_percentage via billing engine. */
export const VAPI_VOICE_MARGIN_RATE =
  DEFAULT_PLATFORM_SETTINGS.vapi_margin_percentage / 100;

export const WALLET_RECHARGE_GST_RATE = 0.18;
export const WALLET_RECHARGE_MIN_INR = 100;
export const WALLET_RECHARGE_MAX_INR = 20_000;

export { PREMIUM_VAPI_TRIAL_MINUTES } from "@/lib/entitlements";

export const ADMIN_GRANTED_SUBSCRIPTION_ID = "admin_granted";

export const AI_VOICE_BILLING_TRANSPARENCY_COPY =
  "AI Voice calls are billed dynamically based on exact seconds used, real-time USD/INR exchange rates, network provider costs, and a platform margin.";

export interface VapiDynamicCallBill {
  duration_seconds: number;
  vapi_cost_usd: number | null;
  live_usd_to_inr: number;
  applied_fx_rate: number;
  applied_margin_pct: number;
  provider_cost_inr: number;
  customer_charge_inr: number;
  margin_inr: number;
}

export interface VapiBillSplit {
  trial_minutes_applied: number;
  wallet_charge_inr: number;
  customer_charge_inr: number;
}

export interface WalletRechargeBreakdown {
  base_amount_inr: number;
  gst_amount_inr: number;
  total_payable_inr: number;
}

function roundInr(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundUsd(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function roundRate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function calculateWalletRechargeBreakdown(
  baseAmountInr: number
): WalletRechargeBreakdown {
  const base_amount_inr = roundInr(baseAmountInr);
  const gst_amount_inr = roundInr(base_amount_inr * WALLET_RECHARGE_GST_RATE);
  const total_payable_inr = roundInr(base_amount_inr + gst_amount_inr);

  return {
    base_amount_inr,
    gst_amount_inr,
    total_payable_inr,
  };
}

export function calculateWalletRechargeTotalPaise(baseAmountInr: number): number {
  const breakdown = calculateWalletRechargeBreakdown(baseAmountInr);
  return Math.round(breakdown.total_payable_inr * 100);
}

export function calculateVapiBillFromProviderCost(
  vapiCostUsd: number | null | undefined,
  durationSeconds = 0,
  options: {
    settings?: Pick<
      PlatformSettings,
      "vapi_margin_percentage" | "fx_risk_buffer_percentage" | "fallback_usd_to_inr"
    >;
    liveUsdToInr?: number;
  } = {}
): VapiDynamicCallBill {
  const settings = {
    vapi_margin_percentage:
      options.settings?.vapi_margin_percentage ??
      DEFAULT_PLATFORM_SETTINGS.vapi_margin_percentage,
    fx_risk_buffer_percentage:
      options.settings?.fx_risk_buffer_percentage ??
      DEFAULT_PLATFORM_SETTINGS.fx_risk_buffer_percentage,
    fallback_usd_to_inr:
      options.settings?.fallback_usd_to_inr ??
      DEFAULT_PLATFORM_SETTINGS.fallback_usd_to_inr,
  };

  const duration_seconds = Math.max(0, durationSeconds);
  const normalizedUsd =
    typeof vapiCostUsd === "number" && Number.isFinite(vapiCostUsd) && vapiCostUsd > 0
      ? roundUsd(vapiCostUsd)
      : null;

  const live_usd_to_inr = roundRate(
    options.liveUsdToInr ?? settings.fallback_usd_to_inr
  );
  const applied_fx_rate = roundRate(
    live_usd_to_inr * (1 + settings.fx_risk_buffer_percentage / 100)
  );
  const applied_margin_pct = settings.vapi_margin_percentage;

  if (!normalizedUsd) {
    return {
      duration_seconds,
      vapi_cost_usd: null,
      live_usd_to_inr,
      applied_fx_rate,
      applied_margin_pct,
      provider_cost_inr: 0,
      customer_charge_inr: 0,
      margin_inr: 0,
    };
  }

  const provider_cost_inr = roundInr(normalizedUsd * applied_fx_rate);
  const customer_charge_inr = roundInr(
    provider_cost_inr * (1 + applied_margin_pct / 100)
  );
  const margin_inr = roundInr(customer_charge_inr - provider_cost_inr);

  return {
    duration_seconds,
    vapi_cost_usd: normalizedUsd,
    live_usd_to_inr,
    applied_fx_rate,
    applied_margin_pct,
    provider_cost_inr,
    customer_charge_inr,
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
  bill: VapiDynamicCallBill,
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
  const trialMinutesApplied =
    billedMinutes > 0
      ? Math.min(Math.max(0, trialMinutesRemaining), billedMinutes)
      : Math.min(Math.max(0, trialMinutesRemaining), 1);
  const walletFraction =
    billedMinutes > 0
      ? Math.max(0, 1 - trialMinutesApplied / billedMinutes)
      : trialMinutesRemaining > 0
        ? 0
        : 1;
  const wallet_charge_inr = roundInr(bill.customer_charge_inr * walletFraction);

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

export function validateWalletRechargeBaseAmount(baseAmount: number): string | null {
  if (!Number.isFinite(baseAmount)) {
    return "Recharge amount must be a valid number.";
  }

  const normalized = Math.trunc(baseAmount);

  if (normalized < WALLET_RECHARGE_MIN_INR) {
    return `Minimum recharge is ₹${WALLET_RECHARGE_MIN_INR}.`;
  }

  if (normalized > WALLET_RECHARGE_MAX_INR) {
    return `Maximum recharge is ₹${WALLET_RECHARGE_MAX_INR.toLocaleString("en-IN")}.`;
  }

  return null;
}
