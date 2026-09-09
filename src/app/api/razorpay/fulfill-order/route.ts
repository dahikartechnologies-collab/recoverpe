import { NextResponse } from "next/server";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { isMicroTransactionPurchaseType } from "@/lib/razorpay-products";
import {
  fulfillRazorpayOrder,
  verifyRazorpayOrderCaptured,
} from "@/lib/razorpay";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { FulfillRazorpayOrderPayload } from "@/types";

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const body = (await request.json()) as FulfillRazorpayOrderPayload;

    if (!body.order_id?.trim()) {
      return NextResponse.json({ error: "order_id is required." }, { status: 400 });
    }

    const orderId = body.order_id.trim();
    const supabase = createAdminSupabaseClient();

    const { data: orderRow, error: orderError } = await supabase
      .from("razorpay_orders")
      .select("user_id, purchase_type, status")
      .eq("razorpay_order_id", orderId)
      .maybeSingle();

    if (orderError || !orderRow) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (orderRow.user_id !== authResult.userId) {
      return NextResponse.json({ error: "Unauthorized order access." }, { status: 403 });
    }

    if (orderRow.status === "created") {
      const isCaptured = await verifyRazorpayOrderCaptured(orderId);

      if (!isCaptured && !isDevelopmentAppEnv()) {
        return NextResponse.json(
          { error: "Payment not confirmed yet. Please wait and retry." },
          { status: 409 }
        );
      }
    }

    const result = await fulfillRazorpayOrder(supabase, orderId);

    return NextResponse.json({
      success: true,
      purchase_type: result.purchaseType,
      micro_fulfillment:
        isMicroTransactionPurchaseType(result.purchaseType) &&
        result.microFulfillment
          ? result.microFulfillment
          : null,
      message: result.alreadyFulfilled
        ? "Order was already fulfilled."
        : "Order fulfilled successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fulfill Razorpay order.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
