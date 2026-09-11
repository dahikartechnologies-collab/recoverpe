import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { requireDiagnosticsAccess } from "@/lib/diagnostics/access";
import { processRazorpayVirtualAccountCredit } from "@/lib/payments/razorpay-webhook-handler";
import { RazorpaySmartCollectWebhookPayload } from "@/lib/reconciliation/razorpay-smart-collect";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { SimulatePaymentPayload } from "@/types";

export async function POST(request: Request) {
  try {
    // This route credits real wallets. Super-admin access is not a sufficient
    // guard — the endpoint must not exist outside a development deployment.
    if (!isDevelopmentAppEnv()) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const access = await requireDiagnosticsAccess(request);

    if ("error" in access) {
      return access.error;
    }

    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const body = (await request.json()) as SimulatePaymentPayload;
    const contactId = body.contact_id?.trim() ?? "";
    const amountRupees = Number(body.amount_rupees);

    if (!contactId) {
      return NextResponse.json({ error: "contact_id is required." }, { status: 400 });
    }

    if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
      return NextResponse.json(
        { error: "amount_rupees must be a positive number." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, user_id, virtual_account_id")
      .eq("id", contactId)
      .eq("user_id", contextResult.effectiveUserId)
      .maybeSingle();

    if (contactError) {
      return NextResponse.json(
        { error: contactError.message || "Failed to load contact." },
        { status: 500 }
      );
    }

    if (!contact) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }

    const virtualAccountId = contact.virtual_account_id?.trim();

    if (!virtualAccountId) {
      return NextResponse.json(
        {
          error:
            "Contact has no Razorpay virtual account. Provision Smart Collect first.",
        },
        { status: 400 }
      );
    }

    const paymentId =
      body.payment_id?.trim() ||
      `pay_sim_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
    const amountPaise = Math.round(amountRupees * 100);

    const webhookPayload: RazorpaySmartCollectWebhookPayload = {
      event: "virtual_account.credited",
      payload: {
        payment: {
          entity: {
            id: paymentId,
            amount: amountPaise,
            currency: "INR",
            method: "upi",
            status: "captured",
          },
        },
        virtual_account: {
          entity: {
            id: virtualAccountId,
          },
        },
      },
    };

    console.log("[Recoverpe Dev Simulate Payment]", {
      contact_id: contactId,
      payment_id: paymentId,
      amount_rupees: amountRupees,
      virtual_account_id: virtualAccountId,
      user_id: contextResult.effectiveUserId,
    });

    const result = await processRazorpayVirtualAccountCredit(
      supabase,
      webhookPayload,
      { entrypoint: "razorpay" }
    );

    return NextResponse.json(
      {
        simulated: true,
        payment_id: paymentId,
        amount_rupees: amountRupees,
        ...result.body,
      },
      { status: result.httpStatus }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to simulate Smart Collect payment.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
