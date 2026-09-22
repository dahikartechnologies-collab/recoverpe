import { NextResponse } from "next/server";
import {
  BusinessEntitlementRow,
  EntitlementKey,
  hasEntitlement,
} from "@/lib/entitlements";
import { SupabaseClient } from "@supabase/supabase-js";

const BUSINESS_ENTITLEMENT_SELECT =
  "subscription_tier, subscription_status, subscription_expires_at, subscription_billing_tier, razorpay_subscription_id, addons";

export function entitlementForbiddenResponse(
  message = "Upgrade to Starter or above to access this feature."
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      upgrade_required: true,
    },
    { status: 403 }
  );
}

export async function fetchBusinessEntitlementRow(
  supabase: SupabaseClient,
  businessId: string,
  userId?: string
): Promise<BusinessEntitlementRow | null> {
  let query = supabase
    .from("businesses")
    .select(BUSINESS_ENTITLEMENT_SELECT)
    .eq("id", businessId);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as BusinessEntitlementRow;
}

export function requireEntitlementAccess(
  business: BusinessEntitlementRow | null | undefined,
  key: EntitlementKey,
  message?: string
): NextResponse | null {
  if (!hasEntitlement(business, key)) {
    return entitlementForbiddenResponse(message);
  }

  return null;
}
