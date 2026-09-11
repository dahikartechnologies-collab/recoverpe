import { NextResponse } from "next/server";
import {
  ghostModeWriteBlockedResponse,
  resolveEffectiveUserContext,
} from "@/lib/api-auth";
import { recordCommunicationSafely } from "@/lib/communication-logs";
import { revalidateDashboardData } from "@/lib/dashboard-cache";
import { createShortLivedSignedUrl } from "@/lib/firebase-storage-admin";
import { formatDisplayInvoice } from "@/lib/invoice-display";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import {
  assertWorkspacePermission,
  resolveWorkspaceAccess,
} from "@/lib/workspace-rbac";
import { ReconciliationStatus } from "@/types";

export const dynamic = "force-dynamic";

const RECONCILIATION_COLUMNS =
  "id, user_id, business_id, contact_id, ledger_id, external_message_id, media_id, extracted_utr, extracted_amount, extracted_date, raw_extraction, status, reviewed_at, reviewed_by, created_at";

export interface ReconciliationQueueEntry {
  id: string;
  status: ReconciliationStatus;
  extracted_utr: string | null;
  extracted_amount: number | null;
  extracted_date: string | null;
  created_at: string;
  contact_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  ledger_id: string | null;
  suggested_invoice: string | null;
  suggested_invoice_balance: number | null;
  proof_url: string | null;
  source: string;
}

interface ContactJoin {
  id: string;
  name: string;
  phone_number: string;
}

interface LedgerJoin {
  id: string;
  invoice_number: string | null;
  balance_due: number;
}

/**
 * Proof objects live in a private bucket. The queue renders them with a plain
 * <img>, which cannot send a bearer token, so each row carries its own
 * short-lived signed URL instead of a durable public link.
 */
async function signProofUrl(storagePath: string | null): Promise<string | null> {
  if (!storagePath) {
    return null;
  }

  try {
    return await createShortLivedSignedUrl(storagePath);
  } catch (error) {
    console.error(
      "[RECONCILIATION] Failed to sign proof URL:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function GET(request: Request) {
  const context = await resolveEffectiveUserContext(request);

  if ("error" in context) {
    return context.error;
  }

  try {
    const access = await resolveWorkspaceAccess(
      context.actorUserId,
      context.effectiveUserId
    );

    assertWorkspacePermission(
      access,
      "edit_ledgers",
      "Forbidden. Missing required permission: edit_ledgers."
    );

    const supabase = createAdminSupabaseClient();
    const requestedStatus = new URL(request.url).searchParams.get("status");
    const status: ReconciliationStatus =
      requestedStatus === "approved" || requestedStatus === "rejected"
        ? requestedStatus
        : "pending_review";

    const { data, error } = await supabase
      .from("reconciliations")
      .select(
        `id, status, extracted_utr, extracted_amount, extracted_date, created_at, contact_id, ledger_id, proof_url, source,
         contacts ( id, name, phone_number ),
         ledgers ( id, invoice_number, balance_due )`
      )
      .eq("user_id", context.effectiveUserId)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const reconciliations: ReconciliationQueueEntry[] = await Promise.all(
      (data ?? []).map(async (row) => {
        const contact = firstOrNull(
          row.contacts as unknown as ContactJoin | ContactJoin[] | null
        );
        const ledger = firstOrNull(
          row.ledgers as unknown as LedgerJoin | LedgerJoin[] | null
        );

        return {
          id: row.id as string,
          status: row.status as ReconciliationStatus,
          extracted_utr: (row.extracted_utr as string | null) ?? null,
          extracted_amount:
            row.extracted_amount === null || row.extracted_amount === undefined
              ? null
              : Number(row.extracted_amount),
          extracted_date: (row.extracted_date as string | null) ?? null,
          created_at: row.created_at as string,
          contact_id: (row.contact_id as string | null) ?? null,
          contact_name: contact?.name ?? null,
          contact_phone: contact?.phone_number ?? null,
          ledger_id: (row.ledger_id as string | null) ?? null,
          suggested_invoice: ledger
            ? formatDisplayInvoice({
                id: ledger.id,
                invoice_number: ledger.invoice_number,
              })
            : null,
          suggested_invoice_balance: ledger ? Number(ledger.balance_due) : null,
          proof_url: await signProofUrl(row.proof_url as string | null),
          source: (row.source as string | null) ?? "whatsapp",
        };
      })
    );

    return NextResponse.json({ reconciliations });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load reconciliations.";
    const status = message.startsWith("Forbidden") ? 403 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  const context = await resolveEffectiveUserContext(request);

  if ("error" in context) {
    return context.error;
  }

  const ghostBlocked = ghostModeWriteBlockedResponse(context);

  if (ghostBlocked) {
    return ghostBlocked;
  }

  try {
    const access = await resolveWorkspaceAccess(
      context.actorUserId,
      context.effectiveUserId
    );

    assertWorkspacePermission(
      access,
      "edit_ledgers",
      "Forbidden. Missing required permission: edit_ledgers."
    );

    const body = (await request.json()) as {
      id?: string;
      action?: string;
    };
    const reconciliationId = body.id?.trim();
    const action = body.action;

    if (!reconciliationId) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "action must be approve or reject." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    const { data: reconciliation, error: loadError } = await supabase
      .from("reconciliations")
      .select(RECONCILIATION_COLUMNS)
      .eq("id", reconciliationId)
      .eq("user_id", context.effectiveUserId)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }

    if (!reconciliation) {
      return NextResponse.json(
        { error: "Reconciliation not found." },
        { status: 404 }
      );
    }

    if (reconciliation.status !== "pending_review") {
      return NextResponse.json(
        { error: "This claim has already been reviewed." },
        { status: 409 }
      );
    }

    const nextStatus: ReconciliationStatus =
      action === "approve" ? "approved" : "rejected";

    // Claim the row before doing any work. The status filter makes this a
    // compare-and-set, so a double click cannot settle the same claim twice.
    const { data: claimed, error: claimError } = await supabase
      .from("reconciliations")
      .update({
        status: nextStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.actorUserId,
      })
      .eq("id", reconciliationId)
      .eq("user_id", context.effectiveUserId)
      .eq("status", "pending_review")
      .select("id")
      .maybeSingle();

    if (claimError) {
      return NextResponse.json({ error: claimError.message }, { status: 500 });
    }

    if (!claimed) {
      return NextResponse.json(
        { error: "This claim has already been reviewed." },
        { status: 409 }
      );
    }

    const utr = (reconciliation.extracted_utr as string | null) ?? null;
    const claimedAmount = Number(reconciliation.extracted_amount ?? 0);
    let settledAmount = 0;

    if (action === "approve") {
      const ledgerId = (reconciliation.ledger_id as string | null) ?? null;

      if (!ledgerId || !Number.isFinite(claimedAmount) || claimedAmount <= 0) {
        await supabase
          .from("reconciliations")
          .update({ status: "pending_review", reviewed_at: null, reviewed_by: null })
          .eq("id", reconciliationId);

        return NextResponse.json(
          {
            error:
              "This claim needs a linked invoice and a positive amount before it can be settled.",
          },
          { status: 400 }
        );
      }

      const { data: ledger, error: ledgerError } = await supabase
        .from("ledgers")
        .select("id, balance_due, contact_id")
        .eq("id", ledgerId)
        .eq("user_id", context.effectiveUserId)
        .maybeSingle();

      if (ledgerError || !ledger) {
        await supabase
          .from("reconciliations")
          .update({ status: "pending_review", reviewed_at: null, reviewed_by: null })
          .eq("id", reconciliationId);

        return NextResponse.json(
          { error: ledgerError?.message || "Linked invoice not found." },
          { status: 404 }
        );
      }

      // balance_due carries a non-negative CHECK and is recomputed by
      // trg_transactions_calculate_balance_due from the sum of transactions,
      // so an over-payment would fail the constraint rather than overpay.
      settledAmount = Math.min(claimedAmount, Number(ledger.balance_due));

      if (settledAmount <= 0) {
        await supabase
          .from("reconciliations")
          .update({ status: "pending_review", reviewed_at: null, reviewed_by: null })
          .eq("id", reconciliationId);

        return NextResponse.json(
          { error: "This invoice has no outstanding balance." },
          { status: 400 }
        );
      }

      // Insert a transaction rather than writing balance_due directly: the
      // trigger recomputes balance and status from the transaction history,
      // and a manual edit would be discarded by the next payment.
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          ledger_id: ledger.id,
          transaction_type: "payment_received",
          amount: settledAmount,
          payment_method: "upi_link",
          reference_id: utr,
          logged_by_user_id: context.actorUserId,
        });

      if (transactionError) {
        await supabase
          .from("reconciliations")
          .update({ status: "pending_review", reviewed_at: null, reviewed_by: null })
          .eq("id", reconciliationId);

        return NextResponse.json(
          { error: transactionError.message || "Failed to settle the payment." },
          { status: 500 }
        );
      }

      revalidateDashboardData(context.effectiveUserId);
    }

    const { data: contact } = await supabase
      .from("contacts")
      .select("id, name, phone_number")
      .eq("id", (reconciliation.contact_id as string | null) ?? "")
      .eq("user_id", context.effectiveUserId)
      .maybeSingle();

    if (contact?.phone_number) {
      const utrText = utr ?? "not detected";
      const messageBody =
        action === "approve"
          ? `Your payment of Rs. ${settledAmount.toLocaleString("en-IN")} (UTR: ${utrText}) has been approved and settled against your khata. Thank you! - RecoverPe`
          : `Your payment proof (UTR: ${utrText}) could not be verified by our accounts team. Please contact us to resolve this. - RecoverPe`;

      await sendWhatsAppTextMessage(contact.phone_number as string, messageBody);

      await recordCommunicationSafely(supabase, {
        userId: context.effectiveUserId,
        businessId: (reconciliation.business_id as string | null) ?? null,
        contactId: contact.id as string,
        ledgerId: (reconciliation.ledger_id as string | null) ?? null,
        type: "whatsapp_reminder",
        channel: "whatsapp",
        direction: "outbound",
        status: "sent",
        summary:
          action === "approve"
            ? "Payment proof approved and settled"
            : "Payment proof rejected",
      });
    }

    return NextResponse.json({
      id: reconciliationId,
      status: nextStatus,
      settled_amount: action === "approve" ? settledAmount : 0,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to review reconciliation.";
    const status = message.startsWith("Forbidden") ? 403 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
