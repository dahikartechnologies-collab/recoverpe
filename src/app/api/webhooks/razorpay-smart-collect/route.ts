import { NextResponse } from "next/server";
import { processRazorpayVirtualAccountCredit } from "@/lib/payments/razorpay-webhook-handler";
import {
  isRazorpaySmartCollectCreditEvent,
  RazorpaySmartCollectWebhookPayload,
} from "@/lib/reconciliation/razorpay-smart-collect";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * DEPRECATED (Sprint 52). Canonical endpoint: POST /api/webhooks/razorpay.
 *
 * This URL previously ran its own FIFO allocation against the legacy
 * virtual_accounts table, so the same payment was booked differently depending
 * on which webhook Razorpay called. It now forwards to the shared wallet-first
 * handler.
 *
 * It deliberately does not return 410. The URL may still be registered in the
 * Razorpay dashboard, and rejecting a live payment notification would drop
 * money on the floor. Remove this route only after confirming no Razorpay
 * webhook points here.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");

    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as RazorpaySmartCollectWebhookPayload;

    console.warn(
      "[smart-collect] Received a webhook on the deprecated /api/webhooks/razorpay-smart-collect endpoint. Repoint the Razorpay webhook to /api/webhooks/razorpay."
    );

    if (!isRazorpaySmartCollectCreditEvent(payload.event)) {
      return NextResponse.json({ received: true, ignored: true, deprecated: true });
    }

    const result = await processRazorpayVirtualAccountCredit(
      createAdminSupabaseClient(),
      payload,
      { entrypoint: "razorpay-smart-collect" }
    );

    return NextResponse.json(
      { ...result.body, deprecated_endpoint: true },
      { status: result.httpStatus }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Razorpay Smart Collect webhook processing failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
