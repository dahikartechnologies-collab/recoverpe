import { NextResponse } from "next/server";
import {
  fetchBusinessEntitlementRow,
  requireEntitlementAccess,
} from "@/lib/entitlement-gate";
import { SupabaseClient } from "@supabase/supabase-js";

export async function requireInboxAccess(
  supabase: SupabaseClient,
  businessId: string | null | undefined,
  userId: string
): Promise<NextResponse | null> {
  if (!businessId) {
    return NextResponse.json(
      {
        error: "Switch to a business workspace to access Live Inbox.",
        upgrade_required: true,
      },
      { status: 403 }
    );
  }

  const business = await fetchBusinessEntitlementRow(supabase, businessId, userId);

  return requireEntitlementAccess(
    business,
    "inbox",
    "Upgrade to Starter or above to access Live Inbox."
  );
}
