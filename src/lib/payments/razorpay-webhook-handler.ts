import { SupabaseClient } from "@supabase/supabase-js";
import { reconcileContactVirtualAccountCredit } from "@/lib/payments/wallet-reconciliation";
import {
  parseRazorpaySmartCollectCredit,
  RazorpaySmartCollectWebhookPayload,
} from "@/lib/reconciliation/razorpay-smart-collect";

export interface WebhookHandlerResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

/**
 * Single handler for Razorpay virtual_account.credited, shared by the canonical
 * /api/webhooks/razorpay endpoint and the deprecated
 * /api/webhooks/razorpay-smart-collect forwarder.
 *
 * Both endpoints must behave identically: before Sprint 52 they booked the same
 * event under two different accounting models, so whichever URL Razorpay
 * happened to call determined how the money was recorded.
 */
export async function processRazorpayVirtualAccountCredit(
  supabase: SupabaseClient,
  payload: RazorpaySmartCollectWebhookPayload,
  meta: { entrypoint: "razorpay" | "razorpay-smart-collect" }
): Promise<WebhookHandlerResult> {
  const credit = parseRazorpaySmartCollectCredit(payload);

  if (!credit) {
    return {
      httpStatus: 400,
      body: { error: "Unable to parse virtual_account.credited payload." },
    };
  }

  const walletResult = await reconcileContactVirtualAccountCredit(
    supabase,
    credit
  );

  if (!walletResult) {
    // Returning 200 keeps Razorpay from retrying an account we will never own.
    console.warn(
      `[smart-collect] Unrecognised virtual account ${credit.razorpayVirtualAccountId} via ${meta.entrypoint}.`
    );

    return {
      httpStatus: 200,
      body: {
        received: true,
        ignored: true,
        reason: "virtual_account_not_linked_to_contact",
      },
    };
  }

  return {
    httpStatus: 200,
    body: {
      received: true,
      smart_collect: true,
      entrypoint: meta.entrypoint,
      wallet_reconciliation: walletResult,
    },
  };
}
