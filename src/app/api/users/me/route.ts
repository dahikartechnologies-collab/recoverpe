import { NextResponse } from "next/server";
import { countUserLedgers } from "@/lib/razorpay";
import {
  requireActorIdentity,
  resolveIdentityProfileUserId,
} from "@/lib/identity-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { CurrentUserResponse, RecoverpeUser } from "@/types";

export async function GET(request: Request) {
  try {
    const identityResult = await requireActorIdentity(request, {
      allowGhostMode: true,
    });

    if ("error" in identityResult) {
      return identityResult.error;
    }

    const profileUserId = await resolveIdentityProfileUserId(identityResult);
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .select(
        "id, firebase_uid, email, phone_number, full_name, billing_address, alternate_phone, default_upi_vpa, subscription_plan, premium_expires_at, recovery_upsell_shown, vapi_wallet_balance, is_super_admin, account_status, eligible_for_discount, created_at"
      )
      .eq("id", profileUserId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const ledgerCount = await countUserLedgers(supabase, profileUserId);

    const user: RecoverpeUser = {
      ...(data as Omit<RecoverpeUser, "ledger_count">),
      is_super_admin: Boolean(data.is_super_admin),
      account_status: (data.account_status as RecoverpeUser["account_status"]) ?? "active",
      eligible_for_discount: Boolean(data.eligible_for_discount),
      recovery_upsell_shown: Boolean(data.recovery_upsell_shown),
      premium_expires_at: (data.premium_expires_at as string | null) ?? null,
      ledger_count: ledgerCount,
    };

    const response: CurrentUserResponse = {
      user,
      ghost_mode: {
        active: identityResult.isGhostMode,
        impersonated_user_id: identityResult.impersonatedUserId,
        impersonated_user_email: identityResult.impersonatedUserEmail,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load user profile.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
