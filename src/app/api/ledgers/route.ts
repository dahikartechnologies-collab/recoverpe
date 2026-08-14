import { NextResponse } from "next/server";
import { resolveEffectiveUserContext, ghostModeWriteBlockedResponse } from "@/lib/api-auth";
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
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { Business, Contact, CreateLedgerPayload, Ledger, WorkspaceMode } from "@/types";

async function upsertContact(
  userId: string,
  contactName: string,
  phoneNumber: string,
  clientGstin: string | null
): Promise<Contact> {
  const supabase = createAdminSupabaseClient();
  const formattedPhone = formatIndianPhoneNumber(phoneNumber);

  const { data: existingContact, error: lookupError } = await supabase
    .from("contacts")
    .select(
      "id, user_id, name, phone_number, client_gstin, billing_address, created_at"
    )
    .eq("user_id", userId)
    .eq("phone_number", formattedPhone)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message || "Failed to lookup contact.");
  }

  if (existingContact) {
    const { data: updatedContact, error: updateError } = await supabase
      .from("contacts")
      .update({
        name: contactName.trim(),
        client_gstin: clientGstin?.trim() || existingContact.client_gstin,
      })
      .eq("id", existingContact.id)
      .select(
        "id, user_id, name, phone_number, client_gstin, billing_address, created_at"
      )
      .single();

    if (updateError || !updatedContact) {
      throw new Error(updateError?.message || "Failed to update contact.");
    }

    return updatedContact as Contact;
  }

  const { data: createdContact, error: createError } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      name: contactName.trim(),
      phone_number: formattedPhone,
      client_gstin: clientGstin?.trim() || null,
    })
    .select(
      "id, user_id, name, phone_number, client_gstin, billing_address, created_at"
    )
    .single();

  if (createError || !createdContact) {
    throw new Error(createError?.message || "Failed to create contact.");
  }

  return createdContact as Contact;
}

export async function GET(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

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
      });
    }

    const supabase = createAdminSupabaseClient();
    const ledgers = await fetchLedgersForWorkspace(
      supabase,
      contextResult.effectiveUserId,
      workspaceMode,
      businessId
    );
    const metrics = await computeDashboardMetrics(supabase, ledgers);

    return NextResponse.json({ ledgers, metrics });
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

    const body = (await request.json()) as CreateLedgerPayload;

    if (!body.contact_name?.trim()) {
      return NextResponse.json({ error: "Contact name is required." }, { status: 400 });
    }

    if (!body.phone_number?.trim()) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
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

    if (body.generate_tax_invoice && body.workspace_mode === "business") {
      if (!body.business_id) {
        return NextResponse.json(
          { error: "Select a business profile before generating a tax invoice." },
          { status: 400 }
        );
      }

      if (!body.upi_vpa?.trim()) {
        return NextResponse.json(
          { error: "UPI VPA is required to generate an invoice with payment QR." },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminSupabaseClient();

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("subscription_plan")
      .eq("id", contextResult.effectiveUserId)
      .single();

    if (userError || !userRow) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    if (userRow.subscription_plan === "free") {
      const ledgerCount = await countUserLedgers(supabase, contextResult.effectiveUserId);

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

    const contact = await upsertContact(
      contextResult.effectiveUserId,
      body.contact_name,
      body.phone_number,
      body.client_gstin ?? null
    );

    let business: Business | null = null;
    let invoiceNumber: string | null = null;

    if (body.workspace_mode === "business" && body.business_id) {
      const { data: businessData, error: businessError } = await supabase
        .from("businesses")
        .select(
          "id, user_id, business_name, gstin, logo_url, invoice_prefix, financial_year_suffix, next_invoice_sequence, created_at"
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
        ledgerId: ledger.id,
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

      return NextResponse.json({ ledger: updatedLedger as Ledger }, { status: 201 });
    }

    return NextResponse.json({ ledger: ledger as Ledger }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create ledger entry.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
