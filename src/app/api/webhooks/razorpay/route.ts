import { NextResponse } from "next/server";
import {
  extractRazorpayOrderIdFromWebhook,
  fulfillRazorpayOrder,
  verifyRazorpayWebhookSignature,
} from "@/lib/razorpay";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as {
      event?: string;
    };

    const supportedEvents = new Set(["payment.captured", "order.paid"]);

    if (!payload.event || !supportedEvents.has(payload.event)) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const razorpayOrderId = extractRazorpayOrderIdFromWebhook(payload);

    if (!razorpayOrderId) {
      return NextResponse.json(
        { error: "Unable to resolve Razorpay order ID from webhook payload." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const result = await fulfillRazorpayOrder(supabase, razorpayOrderId);

    return NextResponse.json({
      received: true,
      fulfilled: !result.alreadyFulfilled,
      purchase_type: result.purchaseType,
      user_id: result.userId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Razorpay webhook processing failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
