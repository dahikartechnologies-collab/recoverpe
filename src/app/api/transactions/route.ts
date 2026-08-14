import { NextResponse } from "next/server";
import { ghostModeWriteBlockedResponse, resolveEffectiveUserContext } from "@/lib/api-auth";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { CreateTransactionPayload, Transaction } from "@/types";

const OFFLINE_PAYMENT_METHODS = new Set(["cash_manual", "bank_transfer"]);

export async function POST(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const ghostBlocked = ghostModeWriteBlockedResponse(contextResult);

    if (ghostBlocked) {
      return ghostBlocked;
    }

    const body = (await request.json()) as CreateTransactionPayload;

    if (!body.ledger_id?.trim()) {
      return NextResponse.json({ error: "ledger_id is required." }, { status: 400 });
    }

    if (!Number.isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number." },
        { status: 400 }
      );
    }

    if (!OFFLINE_PAYMENT_METHODS.has(body.payment_method)) {
      return NextResponse.json(
        { error: "payment_method must be cash_manual or bank_transfer." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const ledger = await fetchLedgerById(
      supabase,
      contextResult.effectiveUserId,
      body.ledger_id.trim()
    );

    if (!ledger) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    if (ledger.balance_due <= 0) {
      return NextResponse.json(
        { error: "This ledger has no outstanding balance." },
        { status: 400 }
      );
    }

    if (body.amount > ledger.balance_due) {
      return NextResponse.json(
        { error: "Payment amount cannot exceed the current balance due." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("transactions")
      .insert({
        ledger_id: ledger.id,
        transaction_type: "payment_received",
        amount: body.amount,
        payment_method: body.payment_method,
        reference_id: body.reference_id?.trim() || null,
      })
      .select(
        "id, ledger_id, transaction_type, amount, payment_method, reference_id, logged_at"
      )
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to log payment." },
        { status: 500 }
      );
    }

    const { data: updatedLedger, error: ledgerError } = await supabase
      .from("ledgers")
      .select(
        "id, user_id, contact_id, business_id, invoice_number, source_type, total_amount, balance_due, due_date, status, is_custom_pdf, pdf_url, current_version, communication_paused, created_at, updated_at"
      )
      .eq("id", ledger.id)
      .single();

    if (ledgerError || !updatedLedger) {
      return NextResponse.json(
        { error: ledgerError?.message || "Payment logged but ledger refresh failed." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        transaction: data as Transaction,
        ledger: updatedLedger,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to log payment.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
