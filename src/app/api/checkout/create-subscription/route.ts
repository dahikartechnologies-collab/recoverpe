import { NextResponse } from "next/server";
import { withWorkspaceAuth } from "@/lib/auth-gateway";
import {
  isSubscriptionPurchaseType,
  resolveSubscriptionPurchaseType,
} from "@/lib/razorpay-products";
import { createRazorpaySubscriptionRecord } from "@/lib/razorpay";
import { extractRazorpaySdkError } from "@/lib/payments/razorpay-client";
import {
  MissingRazorpayPlanError,
} from "@/lib/payments/razorpay-plan-resolver";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { CreateSubscriptionCheckoutPayload, Tier } from "@/types";

function isTier(value: string): value is Tier {
  return value === "starter" || value === "business" || value === "premium";
}

export const POST = withWorkspaceAuth(async (request, auth) => {
  try {
    const body = (await request.json()) as Partial<CreateSubscriptionCheckoutPayload>;

    const tier = body.tier?.trim() ?? "";
    const interval = body.interval;

    if (!isTier(tier)) {
      return NextResponse.json(
        { error: "tier must be starter, business, or premium." },
        { status: 400 }
      );
    }

    if (interval !== "monthly" && interval !== "annual") {
      return NextResponse.json(
        { error: "interval must be monthly or annual." },
        { status: 400 }
      );
    }

    const purchaseType = resolveSubscriptionPurchaseType(tier, interval);

    if (!isSubscriptionPurchaseType(purchaseType)) {
      return NextResponse.json(
        { error: "Unable to resolve subscription plan for the requested tier." },
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
        purchaseType,
        eligibleForDiscount
      );

    return NextResponse.json({
      success: true,
      simulated,
      subscription,
      key: publicKey,
      tier,
      interval,
      purchase_type: purchaseType,
      amount_paise,
      discount_applied,
      message: simulated
        ? "Simulated Razorpay subscription created for development checkout."
        : "Razorpay subscription created successfully.",
    });
  } catch (error) {
    console.error("[RAZORPAY SDK ERROR]:", JSON.stringify(error, null, 2));
    console.error(
      "[checkout/create-subscription] Failed to create subscription checkout:",
      error instanceof Error ? error.message : error
    );

    if (error instanceof MissingRazorpayPlanError) {
      return NextResponse.json(
        {
          error: error.message,
          missing_env: error.missingEnv,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: extractRazorpaySdkError(error),
      },
      { status: 400 }
    );
  }
}, { ownerOnly: true });
