import { NextResponse } from "next/server";
import {
  identityWriteBlockedResponse,
  requireActorIdentity,
} from "@/lib/identity-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const identityResult = await requireActorIdentity(request);

    if ("error" in identityResult) {
      return identityResult.error;
    }

    const ghostBlocked = identityWriteBlockedResponse(identityResult);

    if (ghostBlocked) {
      return ghostBlocked;
    }

    const supabase = createAdminSupabaseClient();

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select(
        "id, subscription_plan, recovery_upsell_shown, eligible_for_discount"
      )
      .eq("id", identityResult.actorUserId)
      .single();

    if (userError || !userRow) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    if (userRow.recovery_upsell_shown) {
      return NextResponse.json({
        success: true,
        already_shown: true,
        eligible_for_discount: Boolean(userRow.eligible_for_discount),
      });
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({
        recovery_upsell_shown: true,
        eligible_for_discount: true,
      })
      .eq("id", identityResult.actorUserId)
      .select("eligible_for_discount, recovery_upsell_shown")
      .single();

    if (updateError || !updatedUser) {
      return NextResponse.json(
        { error: updateError?.message || "Failed to record recovery upsell." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      already_shown: false,
      eligible_for_discount: Boolean(updatedUser.eligible_for_discount),
      message: "Recovery milestone discount unlocked.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to record recovery upsell.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
