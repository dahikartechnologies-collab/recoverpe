import { NextResponse } from "next/server";
import { resolveWorkspaceAuth } from "@/lib/auth-gateway";
import { resolveDataAccessScope } from "@/lib/workspace-data-scope";
import { ghostModeWriteBlockedResponse, resolveEffectiveUserContext } from "@/lib/api-auth";
import { assertWorkspacePermission, resolveWorkspaceAccess } from "@/lib/workspace-rbac";
import {
  computeDashboardMetrics,
  fetchLedgersForWorkspace,
} from "@/lib/ledger-queries";
import { uploadSecureInvoicePdf } from "@/lib/firebase-storage-admin";
import { calculateGstBreakdown } from "@/lib/gst";
import { buildInvoiceNumber, formatIndianPhoneNumber } from "@/lib/invoices";
import { renderInvoicePdfBuffer } from "@/lib/pdf";
import { countUserLedgers } from "@/lib/razorpay";
import { FREE_PLAN_LEDGER_LIMIT } from "@/lib/razorpay-products";
import { isValidContactEmail } from "@/lib/notification-settings";
import { upsertContactForUser } from "@/lib/contact-upsert";
import { scheduleContactVirtualAccountProvisioning } from "@/lib/payments/provision-contact-virtual-account";
import { refreshContactRiskScoreAsync } from "@/lib/contact-risk-score";
import { revalidateDashboardData } from "@/lib/dashboard-cache";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { fireUdhaarReceiptMessage } from "@/lib/whatsapp/udhaar-receipt";
import { Business, Contact, CreateLedgerPayload, Ledger, WorkspaceMode } from "@/types";

interface UpsertContactResult {
  contact: Contact;
  isNew: boolean;
}

async function upsertContact(
  userId: string,
  contactName: string,
  phoneNumber: string,
  clientGstin: string | null,
  contactEmail: string | null
): Promise<UpsertContactResult> {
  return upsertContactForUser(userId, {
    contactName,
    phoneNumber,
    clientGstin,
    contactEmail,
  });
}

export async function GET(request: Request) {
  try {
    const authResult = await resolveWorkspaceAuth(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const dataScope = resolveDataAccessScope(authResult);

    const { searchParams } = new URL(request.url);
    const workspaceMode = searchParams.get("workspace_mode") as WorkspaceMode | null;
    const businessId = searchParams.get("business_id");

    if (workspaceMode !== "personal" && workspaceMode !== "business") {
      return NextResponse.json(
        { error: "workspace_mode must be personal or business." },
        { status: 400 }
      );
    }

    if (workspaceMode === "business" && !businessId) {
      return NextResponse.json({
        ledgers: [],
        metrics: {
          totalOutstanding: 0,
          severelyOverdue: 0,
          recoveredViaRecoverpe: 0,
        },
        pagination: {
          total: 0,
          limit: 50,
          offset: 0,
          page: 1,
          hasMore: false,
        },
      });
    }

    const limitParam = Number.parseInt(searchParams.get("limit") ?? "50", 10);
    const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const offsetParam = searchParams.get("offset");
    const limit = Number.isFinite(limitParam) ? limitParam : 50;
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const offset = offsetParam
      ? Number.parseInt(offsetParam, 10)
      : (page - 1) * limit;

    const supabase = createAdminSupabaseClient();
    const ledgerPage = await fetchLedgersForWorkspace(
      supabase,
      authResult.effectiveUserId,
      workspaceMode,
      businessId,
      {
        limit,
        offset,
        assignedToUserId: dataScope.restrictToAssignedUserId,
      }
    );
    const metrics = await computeDashboardMetrics(
      supabase,
      authResult.effectiveUserId,
      workspaceMode,
      businessId,
      ledgerPage.ledgers,
      { forceFallback: Boolean(dataScope.restrictToAssignedUserId) }
    );

    const hasMore = ledgerPage.offset + ledgerPage.ledgers.length < ledgerPage.total;

    return NextResponse.json({
      ledgers: ledgerPage.ledgers,
      metrics,
      pagination: {
        total: ledgerPage.total,
        limit: ledgerPage.limit,
        offset: ledgerPage.offset,
        page: Math.floor(ledgerPage.offset / ledgerPage.limit) + 1,
        hasMore,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load ledgers.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
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

    const workspaceAccess = await resolveWorkspaceAccess(
      contextResult.actorUserId,
      contextResult.effectiveUserId
    );

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

    const body = (await request.json()) as CreateLedgerPayload;

    if (!body.contact_name?.trim()) {
      return NextResponse.json({ error: "Contact name is required." }, { status: 400 });
    }

    if (!body.phone_number?.trim()) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }

    if (body.contact_email?.trim() && !isValidContactEmail(body.contact_email)) {
      return NextResponse.json(
        { error: "Enter a valid contact email address." },
        { status: 400 }
      );
    }

    if (!body.due_date) {
      return NextResponse.json({ error: "Due date is required." }, { status: 400 });
    }

    if (!Number.isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("subscription_plan, default_upi_vpa, email")
      .eq("id", contextResult.effectiveUserId)
      .single();

    if (userError || !userRow) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    if (body.generate_tax_invoice && body.workspace_mode === "business") {
      if (!body.business_id) {
        return NextResponse.json(
          { error: "Select a business profile before generating a tax invoice." },
          { status: 400 }
        );
      }

      const resolvedUpiVpa =
        body.upi_vpa?.trim() ||
        (userRow.default_upi_vpa as string | null)?.trim() ||
        "";

      if (!resolvedUpiVpa) {
        return NextResponse.json(
          {
            error:
              "UPI VPA is required to generate an invoice with payment QR. Set a default VPA in Settings or enter one now.",
          },
          { status: 400 }
        );
      }

      body.upi_vpa = resolvedUpiVpa;
    }

    // Activation signal for the acquisition funnel: a user who records their
    // first receivable has crossed from signup into real usage.
    const priorLedgerCount = await countUserLedgers(
      supabase,
      contextResult.effectiveUserId
    );
    const isFirstLedger = priorLedgerCount === 0;

    if (userRow.subscription_plan === "free") {
      const ledgerCount = priorLedgerCount;

      if (ledgerCount >= FREE_PLAN_LEDGER_LIMIT) {
        return NextResponse.json(
          {
            error: `Free plan is limited to ${FREE_PLAN_LEDGER_LIMIT} invoices. Upgrade to Premium to add more.`,
            upgrade_required: true,
            ledger_count: ledgerCount,
            ledger_limit: FREE_PLAN_LEDGER_LIMIT,
          },
          { status: 402 }
        );
      }
    }

    const { contact, isNew: isNewContact } = await upsertContact(
      contextResult.effectiveUserId,
      body.contact_name,
      body.phone_number,
      body.client_gstin ?? null,
      body.contact_email ?? null
    );

    if (isNewContact) {
      scheduleContactVirtualAccountProvisioning({
        userId: contextResult.effectiveUserId,
        contactId: contact.id,
        contactName: contact.name,
      });
    }

    let business: Business | null = null;
    let invoiceNumber: string | null = null;

    if (body.workspace_mode === "business" && body.business_id) {
      const { data: businessData, error: businessError } = await supabase
        .from("businesses")
        .select(
          "id, user_id, business_name, gstin, logo_url, msme_reg_no, invoice_prefix, financial_year_suffix, next_invoice_sequence, created_at"
        )
        .eq("id", body.business_id)
        .eq("user_id", contextResult.effectiveUserId)
        .single();

      if (businessError || !businessData) {
        return NextResponse.json(
          { error: "Business profile not found." },
          { status: 404 }
        );
      }

      business = businessData as Business;

      if (body.generate_tax_invoice) {
        invoiceNumber = buildInvoiceNumber(business);
      }
    }

    const shouldGeneratePdf =
      body.generate_tax_invoice &&
      body.workspace_mode === "business" &&
      Boolean(business);

    const { data: ledger, error: ledgerError } = await supabase
      .from("ledgers")
      .insert({
        user_id: contextResult.effectiveUserId,
        contact_id: contact.id,
        business_id: business?.id ?? null,
        invoice_number: invoiceNumber,
        source_type: "manual_entry",
        total_amount: body.amount,
        balance_due: body.amount,
        due_date: body.due_date,
        status: "pending",
        is_custom_pdf: false,
        pdf_url: null,
        communication_autopilot: true,
      })
      .select(
        "id, user_id, contact_id, business_id, invoice_number, source_type, total_amount, balance_due, due_date, status, is_custom_pdf, pdf_url, current_version, created_at, updated_at"
      )
      .single();

    if (ledgerError || !ledger) {
      return NextResponse.json(
        { error: ledgerError?.message || "Failed to create ledger entry." },
        { status: 500 }
      );
    }

    let finalLedger = ledger;

    if (body.use_wallet_balance) {
      const { data: walletApplied, error: walletError } = await supabase.rpc(
        "debit_contact_wallet",
        {
          p_user_id: contextResult.effectiveUserId,
          p_contact_id: contact.id,
          p_amount: body.amount,
        }
      );

      if (walletError) {
        await supabase.from("ledgers").delete().eq("id", ledger.id);

        return NextResponse.json(
          { error: walletError.message || "Failed to apply wallet balance." },
          { status: 500 }
        );
      }

      const appliedAmount = Number(walletApplied ?? 0);

      if (appliedAmount > 0) {
        const { error: walletPaymentError } = await supabase
          .from("transactions")
          .insert({
            ledger_id: ledger.id,
            transaction_type: "payment_received",
            amount: appliedAmount,
            payment_method: "system_adjustment",
            reference_id: "khata_wallet",
            logged_by_user_id: contextResult.actorUserId,
          });

        if (walletPaymentError) {
          await supabase.rpc("credit_contact_wallet", {
            p_user_id: contextResult.effectiveUserId,
            p_contact_id: contact.id,
            p_amount: appliedAmount,
          });
          await supabase.from("ledgers").delete().eq("id", ledger.id);

          return NextResponse.json(
            {
              error:
                walletPaymentError.message ||
                "Failed to record wallet payment against invoice.",
            },
            { status: 500 }
          );
        }

        const { data: walletSettledLedger, error: walletLedgerError } =
          await supabase
            .from("ledgers")
            .select(
              "id, user_id, contact_id, business_id, invoice_number, source_type, total_amount, balance_due, due_date, status, is_custom_pdf, pdf_url, current_version, created_at, updated_at"
            )
            .eq("id", ledger.id)
            .single();

        if (walletLedgerError || !walletSettledLedger) {
          return NextResponse.json(
            {
              error:
                walletLedgerError?.message ||
                "Wallet applied but ledger refresh failed.",
            },
            { status: 500 }
          );
        }

        finalLedger = walletSettledLedger;
      }
    }

    const businessName =
      business?.business_name?.trim() ||
      (userRow.email as string | undefined)?.split("@")[0] ||
      "Recoverpe";

    try {
      await fireUdhaarReceiptMessage({
        userId: contextResult.effectiveUserId,
        contactId: contact.id,
        contactName: contact.name,
        phone: contact.phone_number,
        amount: body.amount,
        businessId: business?.id ?? null,
        businessName,
        ledgerId: finalLedger.id,
      });
    } catch (receiptError) {
      console.error("[udhaar-receipt] Failed to send WhatsApp receipt:", receiptError);
    }

    let pdfUrl: string | null = null;

    if (shouldGeneratePdf && business && body.upi_vpa) {
      const gstBreakdown = calculateGstBreakdown(
        body.amount,
        business.gstin,
        contact.client_gstin
      );

      const pdfBuffer = await renderInvoicePdfBuffer({
        invoiceNumber: invoiceNumber ?? ledger.id,
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: body.due_date,
        businessName: business.business_name,
        businessGstin: business.gstin,
        businessLogoUrl: business.logo_url,
        contactName: contact.name,
        contactPhone: contact.phone_number,
        clientGstin: contact.client_gstin,
        gstBreakdown,
        upiVpa: body.upi_vpa.trim(),
        ledgerId: finalLedger.id,
        msmeRegNo: business.msme_reg_no,
        showRecoverpeBranding: userRow.subscription_plan !== "premium",
      });

      pdfUrl = await uploadSecureInvoicePdf(ledger.id, pdfBuffer);

      const { data: updatedLedger, error: updateLedgerError } = await supabase
        .from("ledgers")
        .update({ pdf_url: pdfUrl })
        .eq("id", ledger.id)
        .select(
          "id, user_id, contact_id, business_id, invoice_number, source_type, total_amount, balance_due, due_date, status, is_custom_pdf, pdf_url, current_version, created_at, updated_at"
        )
        .single();

      if (updateLedgerError || !updatedLedger) {
        return NextResponse.json(
          { error: updateLedgerError?.message || "Failed to attach invoice PDF." },
          { status: 500 }
        );
      }

      if (invoiceNumber) {
        await supabase
          .from("businesses")
          .update({
            next_invoice_sequence: (business.next_invoice_sequence ?? 1) + 1,
          })
          .eq("id", business.id);
      }

      revalidateDashboardData(contextResult.effectiveUserId);
      refreshContactRiskScoreAsync(supabase, contact.id);
      return NextResponse.json(
        { ledger: updatedLedger as Ledger, is_first_ledger: isFirstLedger },
        { status: 201 }
      );
    }

    revalidateDashboardData(contextResult.effectiveUserId);
    refreshContactRiskScoreAsync(supabase, contact.id);
    return NextResponse.json(
      { ledger: finalLedger as Ledger, is_first_ledger: isFirstLedger },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create ledger entry.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
