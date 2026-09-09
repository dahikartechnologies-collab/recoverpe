import { NextResponse } from "next/server";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { fulfillSimulatedSubscription } from "@/lib/razorpay";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    if (!isDevelopmentAppEnv()) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const authResult = await requireAuthenticatedUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const body = (await request.json()) as { subscription_id?: string };

    if (!body.subscription_id?.trim()) {
      return NextResponse.json(
        { error: "subscription_id is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    const { data: subscriptionRow, error: subscriptionError } = await supabase
      .from("razorpay_subscriptions")
      .select("user_id, purchase_type")
      .eq("razorpay_subscription_id", body.subscription_id.trim())
      .single();

    if (subscriptionError || !subscriptionRow) {
      return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
    }

    if (subscriptionRow.user_id !== authResult.userId) {
      return NextResponse.json(
        { error: "Unauthorized subscription access." },
        { status: 403 }
      );
    }

    console.log("[Recoverpe Razorpay Dev Bypass]", {
      subscription_id: body.subscription_id,
      purchase_type: subscriptionRow.purchase_type,
      user_id: authResult.userId,
    });

    const result = await fulfillSimulatedSubscription(
      supabase,
      body.subscription_id.trim()
    );

    const { data: userRow } = await supabase
      .from("users")
      .select("subscription_plan, vapi_wallet_balance, premium_expires_at")
      .eq("id", authResult.userId)
      .single();

    return NextResponse.json({
      success: true,
      simulated: true,
      purchase_type: result.purchaseType,
      subscription_plan: userRow?.subscription_plan ?? "free",
      premium_expires_at: userRow?.premium_expires_at ?? null,
      vapi_wallet_balance: Number(userRow?.vapi_wallet_balance ?? 0),
      message: "Development subscription simulated and fulfilled successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to simulate Razorpay subscription fulfillment.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
