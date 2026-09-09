import { NextResponse } from "next/server";
import {
  extractRazorpayOrderIdFromWebhook,
  fulfillRazorpayOrder,
  fulfillRazorpaySubscriptionWebhook,
  isSubscriptionWebhookEvent,
  verifyRazorpayWebhookSignature,
} from "@/lib/razorpay";
import { processRazorpayVirtualAccountCredit } from "@/lib/payments/razorpay-webhook-handler";
import {
  isRazorpaySmartCollectCreditEvent,
  RazorpaySmartCollectWebhookPayload,
} from "@/lib/reconciliation/razorpay-smart-collect";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as {
      event?: string;
    } & RazorpaySmartCollectWebhookPayload;
    const supabase = createAdminSupabaseClient();

    if (isRazorpaySmartCollectCreditEvent(payload.event)) {
      try {
        const result = await processRazorpayVirtualAccountCredit(
          supabase,
          payload,
          { entrypoint: "razorpay" }
        );

        return NextResponse.json(result.body, { status: result.httpStatus });
      } catch (walletError) {
        const message =
          walletError instanceof Error
            ? walletError.message
            : "Wallet auto-reconciliation failed.";

        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    if (isSubscriptionWebhookEvent(payload.event)) {
      const result = await fulfillRazorpaySubscriptionWebhook(
        supabase,
        payload.event ?? "",
        payload
      );

      return NextResponse.json({
        received: true,
        subscription_handled: result.handled,
        user_id: result.userId ?? null,
        purchase_type: result.purchaseType ?? null,
        event: payload.event,
      });
    }

    const supportedOrderEvents = new Set(["payment.captured", "order.paid"]);

    if (!payload.event || !supportedOrderEvents.has(payload.event)) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const razorpayOrderId = extractRazorpayOrderIdFromWebhook(payload);

    if (!razorpayOrderId) {
      return NextResponse.json(
        { error: "Unable to resolve Razorpay order ID from webhook payload." },
        { status: 400 }
      );
    }

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
