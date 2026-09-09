import { NextResponse } from "next/server";
import { ghostModeWriteBlockedResponse, resolveEffectiveUserContext } from "@/lib/api-auth";
import { refreshContactRiskScoreAsync } from "@/lib/contact-risk-score";
import { revalidateDashboardData } from "@/lib/dashboard-cache";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { getTraiCurfewMessage, isTraiCurfewActive } from "@/lib/trai-curfew";
import { fireAdvanceReceiptMessage } from "@/lib/whatsapp/advance-receipt";
import {
  draftCourtesyPaymentClearMessage,
  sendWhatsAppMessage,
  TraiCurfewError,
} from "@/lib/whatsapp";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import {
  assertWorkspacePermission,
  fetchLedgerForCollection,
  resolveWorkspaceAccess,
} from "@/lib/workspace-rbac";
import { CreateTransactionPayload, Transaction } from "@/types";

const OFFLINE_PAYMENT_METHODS = new Set([
  "cash_manual",
  "bank_transfer",
  "cheque",
  "upi_link",
]);

async function logWalletAdvance(
  actorUserId: string,
  effectiveUserId: string,
  body: CreateTransactionPayload
) {
  const workspaceAccess = await resolveWorkspaceAccess(actorUserId, effectiveUserId);

  try {
    assertWorkspacePermission(
      workspaceAccess,
      "edit_ledgers",
      "Forbidden. Missing required permission: edit_ledgers."
    );
  } catch (permissionError) {
    return NextResponse.json(
      {
        error:
          permissionError instanceof Error
            ? permissionError.message
            : "Forbidden.",
      },
      { status: 403 }
    );
  }

  if (!body.contact_id?.trim()) {
    return NextResponse.json(
      { error: "contact_id is required for wallet advances." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabaseClient();

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, user_id, name, phone_number")
    .eq("id", body.contact_id.trim())
    .eq("user_id", effectiveUserId)
    .maybeSingle();

  if (contactError) {
    return NextResponse.json(
      { error: contactError.message || "Failed to verify contact." },
      { status: 500 }
    );
  }

  if (!contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }

  const { data: walletBalance, error: walletError } = await supabase.rpc(
    "credit_contact_wallet",
    {
      p_user_id: effectiveUserId,
      p_contact_id: contact.id,
      p_amount: body.amount,
    }
  );

  if (walletError) {
    return NextResponse.json(
      { error: walletError.message || "Failed to credit wallet." },
      { status: 500 }
    );
  }

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .insert({
      contact_id: contact.id,
      ledger_id: null,
      transaction_type: "wallet_advance",
      amount: body.amount,
      payment_method: body.payment_method,
      reference_id: body.reference_id?.trim() || null,
      collection_mode: "manual",
      logged_by_user_id: actorUserId,
    })
    .select(
      "id, ledger_id, contact_id, transaction_type, amount, payment_method, reference_id, logged_at"
    )
    .single();

  if (transactionError || !transaction) {
    return NextResponse.json(
      {
        error:
          transactionError?.message ||
          "Wallet credited but failed to record the advance transaction.",
      },
      { status: 500 }
    );
  }

  const [{ data: businessRow }, { data: userRow }] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, business_name")
      .eq("user_id", effectiveUserId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("users")
      .select("email")
      .eq("id", effectiveUserId)
      .maybeSingle(),
  ]);

  const businessName =
    (businessRow?.business_name as string | undefined)?.trim() ||
    userRow?.email?.split("@")[0] ||
    "Recoverpe";

  try {
    await fireAdvanceReceiptMessage({
      phone: contact.phone_number as string,
      contactName: (contact.name as string).trim() || "Customer",
      businessName,
      amount: body.amount,
      walletBalance: Number(walletBalance),
      contactId: contact.id,
      businessId: (businessRow?.id as string | undefined) ?? null,
    });
  } catch (receiptError) {
    console.error("[advance-receipt] Failed to send WhatsApp receipt:", receiptError);
  }

  revalidateDashboardData(effectiveUserId);
  refreshContactRiskScoreAsync(supabase, contact.id);

  return NextResponse.json(
    {
      wallet_balance: Number(walletBalance),
      amount_credited: body.amount,
      payment_method: body.payment_method,
      reference_id: body.reference_id?.trim() || null,
      transaction,
    },
    { status: 201 }
  );
}

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

    if (!Number.isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number." },
        { status: 400 }
      );
    }

    if (!OFFLINE_PAYMENT_METHODS.has(body.payment_method)) {
      return NextResponse.json(
        {
          error:
            "payment_method must be cash_manual, bank_transfer, cheque, or upi_link.",
        },
        { status: 400 }
      );
    }

    if (!body.ledger_id?.trim()) {
      return logWalletAdvance(
        contextResult.actorUserId,
        contextResult.effectiveUserId,
        body
      );
    }

    const supabase = createAdminSupabaseClient();
    const collectibleLedger = await fetchLedgerForCollection(
      contextResult.actorUserId,
      body.ledger_id.trim()
    );

    if (!collectibleLedger) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    const ledger = await fetchLedgerById(
      supabase,
      collectibleLedger.user_id,
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
        logged_by_user_id: contextResult.actorUserId,
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

    let courtesyWhatsApp:
      | { sent: boolean; simulated?: boolean; message: string }
      | undefined;

    if (Number(updatedLedger.balance_due) === 0) {
      const refreshedLedger = await fetchLedgerById(
        supabase,
        collectibleLedger.user_id,
        ledger.id
      );

      if (refreshedLedger) {
        try {
          if (isTraiCurfewActive()) {
            courtesyWhatsApp = {
              sent: false,
              message: getTraiCurfewMessage(),
            };
          } else {
            const draft = draftCourtesyPaymentClearMessage(
              refreshedLedger,
              body.amount,
              body.payment_method
            );
            const sendResult = await sendWhatsAppMessage(draft);

            await supabase.from("communication_logs").insert({
              ledger_id: ledger.id,
              type: "whatsapp_reminder",
              status: "sent",
              cost_deducted: 0,
              executed_at: new Date().toISOString(),
            });

            courtesyWhatsApp = {
              sent: true,
              simulated: sendResult.simulated,
              message: sendResult.message,
            };
          }
        } catch (courtesyError) {
          const message =
            courtesyError instanceof TraiCurfewError
              ? courtesyError.message
              : courtesyError instanceof Error
                ? courtesyError.message
                : "Courtesy WhatsApp failed.";

          courtesyWhatsApp = {
            sent: false,
            message,
          };
        }
      }
    }

    revalidateDashboardData(collectibleLedger.user_id);
    refreshContactRiskScoreAsync(supabase, ledger.contact_id);

    return NextResponse.json(
      {
        transaction: data as Transaction,
        ledger: updatedLedger,
        courtesy_whatsapp: courtesyWhatsApp ?? null,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to log payment.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
