import { BusinessSubscriptionTier, Tier } from "@/types";
import { parseBusinessAddons } from "@/lib/business-addons";
import { ADMIN_GRANTED_SUBSCRIPTION_ID } from "@/lib/vapi-pricing";

export type EntitlementKey =
  | "core_khata"
  | "whatsapp_reminders"
  | "inbound_ai_bot"
  | "inbox"
  | "zero_mdr_checkout"
  | "settlement_desk_unlimited"
  | "promise_register_unlimited"
  | "sms_receipts"
  | "morning_briefing"
  | "debtor_health_score"
  | "field_agent_network"
  | "omnichannel_escalation"
  | "team_management"
  | "ai_voice_calls";

export interface BusinessEntitlementRow {
  subscription_tier: BusinessSubscriptionTier;
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
  subscription_billing_tier?: BusinessSubscriptionTier | null;
  razorpay_subscription_id?: string | null;
  addons?: unknown;
}

const TIER_ORDER: BusinessSubscriptionTier[] = [
  "free",
  "starter",
  "business",
  "premium",
];

const ENTITLEMENT_MATRIX: Record<EntitlementKey, Tier> = {
  core_khata: "starter",
  whatsapp_reminders: "starter",
  inbound_ai_bot: "starter",
  inbox: "starter",
  zero_mdr_checkout: "business",
  settlement_desk_unlimited: "business",
  promise_register_unlimited: "business",
  sms_receipts: "business",
  morning_briefing: "premium",
  debtor_health_score: "premium",
  field_agent_network: "premium",
  omnichannel_escalation: "premium",
  team_management: "business",
  ai_voice_calls: "premium",
};

const ACTIVE_RAZORPAY_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "authenticated",
]);

function tierRank(tier: BusinessSubscriptionTier): number {
  const normalized = tier === "free" ? "starter" : tier;
  return TIER_ORDER.indexOf(normalized);
}

function normalizeBaseTier(
  tier: BusinessSubscriptionTier | null | undefined
): Tier {
  if (!tier || tier === "free") {
    return "starter";
  }

  return tier;
}

function isSubscriptionExpired(
  subscriptionExpiresAt: string | null | undefined
): boolean {
  if (!subscriptionExpiresAt) {
    return false;
  }

  const expiresAt = new Date(subscriptionExpiresAt);

  if (Number.isNaN(expiresAt.getTime())) {
    return false;
  }

  return expiresAt.getTime() < Date.now();
}

function resolvePaidRazorpayTier(
  business: BusinessEntitlementRow
): Tier | null {
  const subscriptionId = business.razorpay_subscription_id?.trim();
  const status = business.subscription_status?.trim().toLowerCase() ?? "";

  if (
    !subscriptionId ||
    subscriptionId === ADMIN_GRANTED_SUBSCRIPTION_ID ||
    !ACTIVE_RAZORPAY_SUBSCRIPTION_STATUSES.has(status)
  ) {
    return null;
  }

  const paidTier = normalizeBaseTier(business.subscription_tier);

  if (paidTier === "business" || paidTier === "premium") {
    return paidTier;
  }

  return null;
}

function resolveBillingTierFallback(
  business: BusinessEntitlementRow
): Tier | null {
  const billingTier = normalizeBaseTier(business.subscription_billing_tier);

  if (billingTier === "business" || billingTier === "premium") {
    return billingTier;
  }

  return null;
}

function resolveTierAfterGrantExpiry(
  business: BusinessEntitlementRow
): Tier {
  const paidRazorpayTier = resolvePaidRazorpayTier(business);

  if (paidRazorpayTier) {
    return paidRazorpayTier;
  }

  const billingFallback = resolveBillingTierFallback(business);

  if (billingFallback) {
    return billingFallback;
  }

  return "starter";
}

export function resolveEffectiveTier(
  business: BusinessEntitlementRow | null | undefined
): Tier {
  const baseTier = normalizeBaseTier(business?.subscription_tier);

  if (
    (baseTier === "business" || baseTier === "premium") &&
    isSubscriptionExpired(business?.subscription_expires_at)
  ) {
    if (!business) {
      return "starter";
    }

    return resolveTierAfterGrantExpiry(business);
  }

  const addons = parseBusinessAddons(business?.addons);

  const hasLegacyAddon =
    addons.settlement_desk_monthly?.active ||
    addons.promise_register_monthly?.active;

  if (hasLegacyAddon && tierRank(baseTier) < tierRank("business")) {
    return "business";
  }

  return baseTier;
}

export function hasEntitlement(
  business: BusinessEntitlementRow | null | undefined,
  key: EntitlementKey
): boolean {
  const effectiveTier = resolveEffectiveTier(business);
  const requiredTier = ENTITLEMENT_MATRIX[key];

  return tierRank(effectiveTier) >= tierRank(requiredTier);
}

export function listEntitlements(
  business: BusinessEntitlementRow | null | undefined
): EntitlementKey[] {
  return (Object.keys(ENTITLEMENT_MATRIX) as EntitlementKey[]).filter((key) =>
    hasEntitlement(business, key)
  );
}

export function requireEntitlement(
  business: BusinessEntitlementRow | null | undefined,
  key: EntitlementKey
): void {
  if (!hasEntitlement(business, key)) {
    throw new Error(`Upgrade required for ${key.replace(/_/g, " ")}.`);
  }
}

export function isPaidBusinessTier(
  business: BusinessEntitlementRow | null | undefined
): boolean {
  return resolveEffectiveTier(business) !== "starter";
}

export function isPremiumTierBusiness(
  business: BusinessEntitlementRow | null | undefined
): boolean {
  return resolveEffectiveTier(business) === "premium";
}

export function isZeroMdrCheckoutEligible(
  business: BusinessEntitlementRow | null | undefined
): boolean {
  return hasEntitlement(business, "zero_mdr_checkout");
}

/** Included AI voice trial minutes bundled with SaaS tiers (wallet billed thereafter). */
export function getEffectiveVapiMinutesQuota(tier: Tier): number {
  switch (tier) {
    case "starter":
      return 0;
    case "business":
      return 0;
    case "premium":
      return 10;
  }
}
