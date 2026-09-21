import { SupabaseClient } from "@supabase/supabase-js";
import { syncBusinessUsageQuotas } from "@/lib/business-usage-metering";
import { cancelBusinessSubscriptionIfActive } from "@/lib/subscription-lifecycle";
import { AdminManagedBusiness, Tier } from "@/types";

const ADMIN_GRANTED_SUBSCRIPTION_ID = "admin_granted";

export interface GrantBusinessTierInput {
  tier: Extract<Tier, "business" | "premium">;
  days: number;
}

function mapAdminBusinessRow(
  row: Record<string, unknown>,
  ownerEmail: string
): AdminManagedBusiness {
  return {
    id: row.id as string,
    business_name: (row.business_name as string | null)?.trim() || "Untitled business",
    owner_user_id: row.user_id as string,
    owner_email: ownerEmail,
    subscription_tier:
      (row.subscription_tier as AdminManagedBusiness["subscription_tier"]) ??
      "starter",
    subscription_status:
      (row.subscription_status as AdminManagedBusiness["subscription_status"]) ??
      "none",
    subscription_expires_at:
      (row.subscription_expires_at as string | null) ?? null,
    razorpay_subscription_id:
      (row.razorpay_subscription_id as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function grantBusinessTierAccess(
  supabase: SupabaseClient,
  businessId: string,
  input: GrantBusinessTierInput
): Promise<AdminManagedBusiness> {
  if (!Number.isFinite(input.days) || input.days <= 0) {
    throw new Error("days must be a positive number.");
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select(
      "id, user_id, business_name, subscription_tier, subscription_status, subscription_expires_at, razorpay_subscription_id, created_at"
    )
    .eq("id", businessId)
    .maybeSingle();

  if (businessError || !business) {
    throw new Error(businessError?.message || "Business not found.");
  }

  const { data: owner, error: ownerError } = await supabase
    .from("users")
    .select("email")
    .eq("id", business.user_id)
    .maybeSingle();

  if (ownerError || !owner?.email) {
    throw new Error(ownerError?.message || "Business owner not found.");
  }

  await cancelBusinessSubscriptionIfActive(supabase, businessId);

  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + Math.trunc(input.days));

  const { data: updatedBusiness, error: updateError } = await supabase
    .from("businesses")
    .update({
      subscription_tier: input.tier,
      subscription_status: "active",
      subscription_interval: input.days >= 365 ? "annual" : "monthly",
      razorpay_subscription_id: ADMIN_GRANTED_SUBSCRIPTION_ID,
      subscription_expires_at: expiresAt.toISOString(),
      subscription_current_period_end: expiresAt.toISOString(),
    })
    .eq("id", businessId)
    .select(
      "id, user_id, business_name, subscription_tier, subscription_status, subscription_expires_at, razorpay_subscription_id, created_at"
    )
    .single();

  if (updateError || !updatedBusiness) {
    throw new Error(updateError?.message || "Failed to grant tier access.");
  }

  await supabase
    .from("users")
    .update({
      subscription_plan: input.tier === "premium" ? "premium" : "free",
      premium_expires_at: expiresAt.toISOString(),
    })
    .eq("id", business.user_id as string);

  await syncBusinessUsageQuotas(supabase, businessId);

  return mapAdminBusinessRow(
    updatedBusiness as Record<string, unknown>,
    owner.email as string
  );
}

export { mapAdminBusinessRow };
