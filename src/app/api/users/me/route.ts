import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { countUserLedgers } from "@/lib/razorpay";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { CurrentUserResponse, RecoverpeUser } from "@/types";

export async function GET(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .select(
        "id, firebase_uid, email, phone_number, subscription_plan, vapi_wallet_balance, is_super_admin, account_status, eligible_for_discount, created_at"
      )
      .eq("id", contextResult.effectiveUserId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const ledgerCount = await countUserLedgers(supabase, contextResult.effectiveUserId);

    const user: RecoverpeUser = {
      ...(data as Omit<RecoverpeUser, "ledger_count">),
      is_super_admin: Boolean(data.is_super_admin),
      account_status: (data.account_status as RecoverpeUser["account_status"]) ?? "active",
      eligible_for_discount: Boolean(data.eligible_for_discount),
      ledger_count: ledgerCount,
    };

    const response: CurrentUserResponse = {
      user,
      ghost_mode: {
        active: contextResult.isGhostMode,
        impersonated_user_id: contextResult.isGhostMode
          ? contextResult.effectiveUserId
          : null,
        impersonated_user_email: contextResult.impersonatedUserEmail,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load user profile.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
