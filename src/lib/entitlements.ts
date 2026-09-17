import { parseBusinessAddons } from "@/lib/business-addons";
import { BusinessSubscriptionTier } from "@/types";

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
  addons?: unknown;
}

const TIER_ORDER: BusinessSubscriptionTier[] = [
  "free",
  "starter",
  "business",
  "premium",
];

const ENTITLEMENT_MATRIX: Record<EntitlementKey, BusinessSubscriptionTier> = {
  core_khata: "free",
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

function tierRank(tier: BusinessSubscriptionTier): number {
  return TIER_ORDER.indexOf(tier);
}

export function resolveEffectiveTier(
  business: BusinessEntitlementRow | null | undefined
): BusinessSubscriptionTier {
  const baseTier = business?.subscription_tier ?? "free";

  if (baseTier !== "free" && baseTier !== "premium") {
    return baseTier;
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
  return resolveEffectiveTier(business) !== "free";
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
