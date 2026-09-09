import { NextResponse } from "next/server";
import { withWorkspaceAuth } from "@/lib/auth-gateway";
import {
  isSubscriptionPurchaseType,
  SubscriptionPurchaseType,
} from "@/lib/razorpay-products";
import { createRazorpaySubscriptionRecord } from "@/lib/razorpay";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const POST = withWorkspaceAuth(async (request, auth) => {
    const body = (await request.json()) as {
      purchase_type?: SubscriptionPurchaseType;
    };

    if (
      !body.purchase_type ||
      !isSubscriptionPurchaseType(body.purchase_type)
    ) {
      return NextResponse.json(
        {
          error:
            "purchase_type must be subscription_premium or subscription_premium_annual.",
        },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("eligible_for_discount")
      .eq("id", auth.actorUserId)
      .single();

    if (userError || !userRow) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const eligibleForDiscount = Boolean(userRow.eligible_for_discount);

    const { subscription, simulated, publicKey, amount_paise, discount_applied } =
      await createRazorpaySubscriptionRecord(
        supabase,
        auth.actorUserId,
        body.purchase_type,
        eligibleForDiscount
      );

    return NextResponse.json({
      success: true,
      simulated,
      subscription,
      key: publicKey,
      purchase_type: body.purchase_type,
      amount_paise,
      discount_applied,
      message: simulated
        ? "Simulated Razorpay subscription created for development checkout."
        : "Razorpay subscription created successfully.",
    });
}, { ownerOnly: true });
