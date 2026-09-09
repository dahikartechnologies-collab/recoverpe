import { NextResponse } from "next/server";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { isPurchaseType } from "@/lib/razorpay-products";
import { fulfillRazorpayOrder } from "@/lib/razorpay";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { DevFulfillRazorpayPayload } from "@/types";

export async function POST(request: Request) {
  try {
    if (!isDevelopmentAppEnv()) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const authResult = await requireAuthenticatedUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const body = (await request.json()) as DevFulfillRazorpayPayload;

    if (!body.order_id?.trim()) {
      return NextResponse.json({ error: "order_id is required." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: orderRow, error: orderError } = await supabase
      .from("razorpay_orders")
      .select("user_id, purchase_type")
      .eq("razorpay_order_id", body.order_id.trim())
      .single();

    if (orderError || !orderRow) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (orderRow.user_id !== authResult.userId) {
      return NextResponse.json({ error: "Unauthorized order access." }, { status: 403 });
    }

    if (!isPurchaseType(orderRow.purchase_type)) {
      return NextResponse.json({ error: "Invalid purchase type on order." }, { status: 400 });
    }

    console.log("[Recoverpe Razorpay Dev Bypass]", {
      order_id: body.order_id,
      purchase_type: orderRow.purchase_type,
      user_id: authResult.userId,
    });

    const result = await fulfillRazorpayOrder(supabase, body.order_id.trim());

    const { data: userRow } = await supabase
      .from("users")
      .select("subscription_plan, vapi_wallet_balance")
      .eq("id", authResult.userId)
      .single();

    return NextResponse.json({
      success: true,
      simulated: true,
      purchase_type: result.purchaseType,
      subscription_plan: userRow?.subscription_plan ?? "free",
      vapi_wallet_balance: Number(userRow?.vapi_wallet_balance ?? 0),
      micro_fulfillment: result.microFulfillment,
      message: "Development payment simulated and fulfilled successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to simulate Razorpay fulfillment.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
