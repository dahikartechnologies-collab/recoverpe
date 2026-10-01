import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import {
  isSubscriptionPurchaseType,
  resolveSubscriptionPurchaseType,
} from "@/lib/razorpay-products";
import { createRazorpaySubscriptionRecord } from "@/lib/razorpay";
import { extractRazorpaySdkError } from "@/lib/payments/razorpay-client";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { CreateSubscriptionCheckoutPayload, Tier } from "@/types";

function isTier(value: string): value is Tier {
  return value === "starter" || value === "business" || value === "premium";
}

function normalizeBillingInterval(
  value: string
): "monthly" | "annual" | null {
  if (value === "month" || value === "monthly") {
    return "monthly";
  }

  if (value === "year" || value === "annual") {
    return "annual";
  }

  return null;
}

/**
 * Read plan IDs in this route module only.
 * razorpay-products.ts is imported by client components, and Next replaces
 * non-public process.env reads in that shared graph with empty values.
 */
function readCheckoutPlanId(
  tier: Tier,
  interval: "monthly" | "annual",
  eligibleForDiscount: boolean
): string | null {
  if (tier === "starter" && interval === "monthly") {
    return process.env.RAZORPAY_PLAN_STARTER_MONTHLY?.trim() || null;
  }

  if (tier === "starter" && interval === "annual") {
    return process.env.RAZORPAY_PLAN_STARTER_ANNUAL?.trim() || null;
  }

  if (tier === "business" && interval === "monthly") {
    return process.env.RAZORPAY_PLAN_BUSINESS_MONTHLY?.trim() || null;
  }

  if (tier === "business" && interval === "annual") {
    return process.env.RAZORPAY_PLAN_BUSINESS_ANNUAL?.trim() || null;
  }

  if (tier === "premium" && interval === "annual") {
    return process.env.RAZORPAY_PLAN_PREMIUM_ANNUAL?.trim() || null;
  }

  if (tier === "premium" && interval === "monthly" && eligibleForDiscount) {
    const discounted =
      process.env.RAZORPAY_PLAN_PREMIUM_MONTHLY_DISCOUNTED?.trim() || null;

    if (discounted) {
      return discounted;
    }
  }

  if (tier === "premium" && interval === "monthly") {
    return process.env.RAZORPAY_PLAN_PREMIUM_MONTHLY?.trim() || null;
  }

  return null;
}

export const POST = withWorkspaceMutation(async (request, auth) => {
  try {
    const body = (await request.json()) as Partial<CreateSubscriptionCheckoutPayload>;

    const tier = String(body.tier || "").trim().toLowerCase();
    const interval = String(body.interval || "monthly").trim().toLowerCase();
    const normalizedInterval = normalizeBillingInterval(interval);

    if (!isTier(tier)) {
      return NextResponse.json(
        { error: "tier must be starter, business, or premium." },
        { status: 400 }
      );
    }

    if (!normalizedInterval) {
      return NextResponse.json(
        { error: "interval must be monthly or annual." },
        { status: 400 }
      );
    }

    const purchaseType = resolveSubscriptionPurchaseType(tier, normalizedInterval);

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
    const planId = readCheckoutPlanId(tier, normalizedInterval, eligibleForDiscount);
    const hasKeyId = Boolean(process.env.RAZORPAY_KEY_ID?.trim());
    const hasSecret = Boolean(process.env.RAZORPAY_KEY_SECRET?.trim());

    if (!planId) {
      console.error("[checkout/create-subscription] Missing Razorpay plan mapping", {
        tier,
        interval: normalizedInterval,
      });

      return NextResponse.json(
        {
          error:
            "Razorpay subscription plans are not configured for production checkout.",
        },
        { status: 400 }
      );
    }

    if (!hasKeyId || !hasSecret) {
      console.error(
        "[checkout/create-subscription] Razorpay API keys are not configured on this deployment."
      );

      return NextResponse.json(
        {
          error:
            "Razorpay API keys are not available to this deployment. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the Vercel Production environment, then redeploy.",
        },
        { status: 400 }
      );
    }

    const { subscription, simulated, publicKey, amount_paise, discount_applied } =
      await createRazorpaySubscriptionRecord(
        supabase,
        auth.actorUserId,
        purchaseType,
        eligibleForDiscount,
        planId
      );

    return NextResponse.json({
      success: true,
      simulated,
      subscription,
      key: publicKey,
      tier,
      interval: normalizedInterval,
      purchase_type: purchaseType,
      amount_paise,
      discount_applied,
      message: simulated
        ? "Simulated Razorpay subscription created for development checkout."
        : "Razorpay subscription created successfully.",
    });
  } catch (error) {
    console.error(
      "[checkout/create-subscription] Failed to create subscription checkout:",
      extractRazorpaySdkError(error)
    );

    return NextResponse.json(
      {
        error: extractRazorpaySdkError(error),
      },
      { status: 400 }
    );
  }
}, { ownerOnly: true });
