import { SupabaseClient } from "@supabase/supabase-js";
import {
  BusinessEntitlementRow,
  resolveEffectiveTier,
} from "@/lib/entitlements";
import { syncBusinessUsageQuotas } from "@/lib/business-usage-metering";
import { Business, BusinessSubscriptionTier } from "@/types";

export interface ApplyTierFulfillmentInput {
  supabase: SupabaseClient;
  businessId: string;
  tier: BusinessSubscriptionTier;
  status: Business["subscription_status"];
  razorpaySubscriptionId?: string | null;
  periodEnd?: string | null;
  subscriptionInterval?: Business["subscription_interval"];
  subscriptionBillingTier?: BusinessSubscriptionTier | null;
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

export async function applyTierFulfillment(
  input: ApplyTierFulfillmentInput
): Promise<void> {
  const {
    supabase,
    businessId,
    tier,
    status,
    razorpaySubscriptionId = null,
    periodEnd = null,
    subscriptionInterval = null,
    subscriptionBillingTier = null,
  } = input;

  const normalizedTier: BusinessSubscriptionTier = tier === "free" ? "free" : tier;
  const billingTier =
    subscriptionBillingTier ??
    (normalizedTier === "business" || normalizedTier === "premium"
      ? normalizedTier
      : null);

  const { error } = await supabase
    .from("businesses")
    .update({
      subscription_tier: normalizedTier,
      subscription_billing_tier: billingTier,
      subscription_status: status ?? "none",
      subscription_interval: subscriptionInterval,
      subscription_current_period_end: periodEnd,
      subscription_expires_at: periodEnd,
      razorpay_subscription_id: razorpaySubscriptionId,
    })
    .eq("id", businessId);

  if (error) {
    throw new Error(error.message || "Failed to apply tier fulfillment.");
  }

  await syncBusinessUsageQuotas(supabase, businessId);
}

export async function applyTierFulfillmentForUser(
  supabase: SupabaseClient,
  userId: string,
  input: Omit<ApplyTierFulfillmentInput, "supabase" | "businessId">
): Promise<void> {
  const { data: businesses, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      error.message || "Failed to load businesses for tier fulfillment."
    );
  }

  if (!businesses?.length) {
    return;
  }

  await Promise.all(
    businesses.map((business) =>
      applyTierFulfillment({
        supabase,
        businessId: business.id as string,
        ...input,
      })
    )
  );
}

/**
 * Free-tier invoice UX: capped ledgers + RecoverPe watermark.
 * Any active paid Starter/Business/Premium subscription removes both limits.
 */
export function shouldApplyFreeInvoiceLimits(
  business: BusinessEntitlementRow | null | undefined
): boolean {
  if (!business) {
    return true;
  }

  const effectiveTier = resolveEffectiveTier(business);

  if (effectiveTier === "business" || effectiveTier === "premium") {
    return false;
  }

  if (effectiveTier === "starter") {
    const rawTier = business.subscription_tier ?? "free";
    const status = (business.subscription_status ?? "none").toLowerCase();
    const hasActivePaidStarter =
      rawTier === "starter" &&
      status === "active" &&
      !isSubscriptionExpired(business.subscription_expires_at);

    return !hasActivePaidStarter;
  }

  return true;
}

export function shouldShowRecoverpeBranding(
  business: BusinessEntitlementRow | null | undefined
): boolean {
  return shouldApplyFreeInvoiceLimits(business);
}

/** Paid Starter, Business, or Premium unlocks custom autopilot and removes WhatsApp watermarks. */
export function hasPaidTierBenefits(
  business: BusinessEntitlementRow | null | undefined
): boolean {
  return !shouldApplyFreeInvoiceLimits(business);
}
