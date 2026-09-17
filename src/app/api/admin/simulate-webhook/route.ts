import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/api-auth";
import { processRazorpayVirtualAccountCredit } from "@/lib/payments/razorpay-webhook-handler";
import { RazorpaySmartCollectWebhookPayload } from "@/lib/reconciliation/razorpay-smart-collect";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

interface SimulateWebhookPayload {
  ledger_id?: string;
  amount?: number;
}

export async function POST(request: Request) {
  try {
    const authResult = await requireSuperAdminUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const body = (await request.json()) as SimulateWebhookPayload;
    const ledgerId = body.ledger_id?.trim() ?? "";
    const amountRupees = Number(body.amount);

    if (!ledgerId) {
      return NextResponse.json({ error: "ledger_id is required." }, { status: 400 });
    }

    if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: ledger, error: ledgerError } = await supabase
      .from("ledgers")
      .select("id, contact_id, contacts(virtual_account_id)")
      .eq("id", ledgerId)
      .maybeSingle();

    if (ledgerError) {
      return NextResponse.json(
        { error: ledgerError.message || "Failed to load ledger." },
        { status: 500 }
      );
    }

    if (!ledger) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    const contact = ledger.contacts as { virtual_account_id?: string | null } | null;
    const virtualAccountId = contact?.virtual_account_id?.trim();

    if (!virtualAccountId) {
      return NextResponse.json(
        {
          error:
            "Contact has no Razorpay virtual account. Provision Smart Collect first.",
        },
        { status: 400 }
      );
    }

    const paymentId = `pay_sim_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
    const amountPaise = Math.round(amountRupees * 100);

    const webhookPayload: RazorpaySmartCollectWebhookPayload = {
      event: "virtual_account.credited",
      payload: {
        payment: {
          entity: {
            id: paymentId,
            amount: amountPaise,
            currency: "INR",
            method: "bank_transfer",
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

    console.log("[Recoverpe Admin Simulate Webhook]", {
      ledger_id: ledgerId,
      contact_id: ledger.contact_id,
      payment_id: paymentId,
      amount_rupees: amountRupees,
      virtual_account_id: virtualAccountId,
      simulated_by: authResult.userId,
    });

    const result = await processRazorpayVirtualAccountCredit(
      supabase,
      webhookPayload,
      { entrypoint: "razorpay" }
    );

    return NextResponse.json(
      {
        simulated: true,
        ledger_id: ledgerId,
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
        : "Failed to simulate live IMPS credit webhook.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
