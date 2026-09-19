import { NextResponse } from "next/server";
import {
  extractRazorpayOrderIdFromWebhook,
  fulfillRazorpayOrder,
  fulfillRazorpaySubscriptionWebhook,
  handleSubscriptionPaymentFailure,
  isSubscriptionWebhookEvent,
  verifyRazorpayWebhookSignature,
} from "@/lib/razorpay";
import { handleMerchantBankVerificationWebhook } from "@/lib/payments/merchant-bank-verification";
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
    const verification = verifyRazorpayWebhookSignature(rawBody, signature);

    if (!verification.ok) {
      if (verification.missingEnv) {
        console.error(
          `[Recoverpe Razorpay Webhook] Configure ${verification.missingEnv} in Vercel.`
        );
      }

      return NextResponse.json(
        { error: verification.reason },
        { status: verification.missingEnv ? 503 : 401 }
      );
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

    if (payload.event === "payment.failed") {
      const result = await handleSubscriptionPaymentFailure(supabase, payload);

      return NextResponse.json({
        received: true,
        dunning_handled: result.handled,
        user_id: result.userId ?? null,
        event: payload.event,
      });
    }

    const routeAndSettlementEvents = new Set([
      "settlement.processed",
      "refund.processed",
      "transfer.processed",
    ]);

    if (payload.event && routeAndSettlementEvents.has(payload.event)) {
      console.info("[razorpay-webhook] route/settlement event acknowledged", {
        event: payload.event,
      });

      return NextResponse.json({
        received: true,
        handled: payload.event,
        note: "Route/settlement lifecycle event logged; wallet reconciliation unaffected.",
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

    const bankVerificationResult = await handleMerchantBankVerificationWebhook(
      supabase,
      payload,
      razorpayOrderId
    );

    if (bankVerificationResult.handled) {
      return NextResponse.json({
        received: true,
        bank_verification_handled: true,
        business_id: bankVerificationResult.businessId ?? null,
        event: payload.event,
      });
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
