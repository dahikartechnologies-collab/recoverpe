import {
  uploadLegalNoticePdf,
  uploadSamadhaanDocketPdf,
} from "@/lib/firebase-storage-admin";
import { fetchEvidenceForLedger } from "@/lib/evidence-queries";
import { getTodayDateStringInIst } from "@/lib/timezone";
import {
  renderLegalNoticePdfBuffer,
  renderSamadhaanDocketPdfBuffer,
} from "@/lib/pdf";
import {
  MicroTransactionFulfillment,
  PurchaseType,
  SamadhaanFilingMeta,
} from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";

interface FulfillmentContext {
  ledger: {
    id: string;
    user_id: string;
    business_id: string | null;
    invoice_number: string | null;
    total_amount: number;
    balance_due: number;
    due_date: string;
    created_at: string;
    legal_notice_pdf_url: string | null;
    samadhaan_docket_pdf_url: string | null;
  };
  contact: {
    name: string;
    phone_number: string;
    client_gstin: string | null;
    billing_address: string | null;
  };
  business: {
    business_name: string;
    gstin: string | null;
  } | null;
  user: {
    billing_address: string | null;
    full_name: string | null;
  };
}

function addDaysIso(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function computeDaysOverdue(dueDate: string): number {
  const today = getTodayDateStringInIst();
  const due = new Date(`${dueDate}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  const diffMs = now.getTime() - due.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

async function loadFulfillmentContext(
  supabase: SupabaseClient,
  userId: string,
  ledgerId: string
): Promise<FulfillmentContext | null> {
  const { data: ledgerRow, error: ledgerError } = await supabase
    .from("ledgers")
    .select(
      "id, user_id, business_id, invoice_number, total_amount, balance_due, due_date, created_at, legal_notice_pdf_url, samadhaan_docket_pdf_url, contact_id"
    )
    .eq("id", ledgerId)
    .eq("user_id", userId)
    .maybeSingle();

  if (ledgerError || !ledgerRow) {
    return null;
  }

  const { data: contactRow, error: contactError } = await supabase
    .from("contacts")
    .select("name, phone_number, client_gstin, billing_address")
    .eq("id", ledgerRow.contact_id)
    .single();

  if (contactError || !contactRow) {
    return null;
  }

  let business: FulfillmentContext["business"] = null;

  if (ledgerRow.business_id) {
    const { data: businessRow } = await supabase
      .from("businesses")
      .select("business_name, gstin")
      .eq("id", ledgerRow.business_id)
      .eq("user_id", userId)
      .maybeSingle();

    business = businessRow as FulfillmentContext["business"];
  }

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("billing_address, full_name")
    .eq("id", userId)
    .single();

  if (userError || !userRow) {
    return null;
  }

  return {
    ledger: {
      id: ledgerRow.id as string,
      user_id: ledgerRow.user_id as string,
      business_id: ledgerRow.business_id as string | null,
      invoice_number: ledgerRow.invoice_number as string | null,
      total_amount: Number(ledgerRow.total_amount),
      balance_due: Number(ledgerRow.balance_due),
      due_date: ledgerRow.due_date as string,
      created_at: ledgerRow.created_at as string,
      legal_notice_pdf_url: ledgerRow.legal_notice_pdf_url as string | null,
      samadhaan_docket_pdf_url: ledgerRow.samadhaan_docket_pdf_url as string | null,
    },
    contact: contactRow as FulfillmentContext["contact"],
    business,
    user: userRow as FulfillmentContext["user"],
  };
}

function buildSamadhaanMeta(context: FulfillmentContext): SamadhaanFilingMeta {
  return {
    claimant_gstin: context.business?.gstin ?? null,
    debtor_gstin: context.contact.client_gstin,
    debtor_name: context.contact.name,
    invoice_number: context.ledger.invoice_number,
    invoice_date: context.ledger.created_at.slice(0, 10),
    total_outstanding: context.ledger.total_amount,
    balance_due: context.ledger.balance_due,
  };
}

async function fulfillLegalNotice(
  supabase: SupabaseClient,
  context: FulfillmentContext
): Promise<MicroTransactionFulfillment> {
  if (context.ledger.legal_notice_pdf_url) {
    return {
      purchase_type: "legal_notice_999",
      ledger_id: context.ledger.id,
      pdf_url: context.ledger.legal_notice_pdf_url,
    };
  }

  const noticeDate = getTodayDateStringInIst();
  const settlementDeadline = addDaysIso(noticeDate, 7);
  const claimantName =
    context.business?.business_name ||
    context.user.full_name ||
    "Recoverpe User";

  const pdfBuffer = await renderLegalNoticePdfBuffer({
    noticeDate: formatDisplayDate(noticeDate),
    settlementDeadline: formatDisplayDate(settlementDeadline),
    claimantName,
    claimantGstin: context.business?.gstin ?? null,
    claimantAddress: context.user.billing_address,
    debtorName: context.contact.name,
    debtorPhone: context.contact.phone_number,
    debtorGstin: context.contact.client_gstin,
    debtorAddress: context.contact.billing_address,
    invoiceNumber: context.ledger.invoice_number,
    invoiceDate: formatDisplayDate(context.ledger.created_at.slice(0, 10)),
    dueDate: formatDisplayDate(context.ledger.due_date),
    totalAmount: context.ledger.total_amount,
    balanceDue: context.ledger.balance_due,
    daysOverdue: computeDaysOverdue(context.ledger.due_date),
  });

  const pdfStoragePath = await uploadLegalNoticePdf(context.ledger.id, pdfBuffer);

  const { error } = await supabase
    .from("ledgers")
    .update({ legal_notice_pdf_url: pdfStoragePath })
    .eq("id", context.ledger.id)
    .eq("user_id", context.ledger.user_id);

  if (error) {
    throw new Error(error.message || "Failed to save legal notice path.");
  }

  return {
    purchase_type: "legal_notice_999",
    ledger_id: context.ledger.id,
    pdf_url: pdfStoragePath,
  };
}

async function fulfillSamadhaanKit(
  supabase: SupabaseClient,
  context: FulfillmentContext
): Promise<MicroTransactionFulfillment> {
  const samadhaanMeta = buildSamadhaanMeta(context);

  const { data: communicationLogs, error: logsError } = await supabase
    .from("communication_logs")
    .select(
      "executed_at, type, status, sentiment, executive_summary"
    )
    .eq("ledger_id", context.ledger.id)
    .order("executed_at", { ascending: true });

  if (logsError) {
    throw new Error(logsError.message || "Failed to load communication logs.");
  }

  const evidenceAttachments = await fetchEvidenceForLedger(
    supabase,
    context.ledger.user_id,
    context.ledger.id
  );

  const pdfBuffer = await renderSamadhaanDocketPdfBuffer({
    generatedAt: formatDisplayDate(getTodayDateStringInIst()),
    businessName: context.business?.business_name || "Personal Workspace",
    businessGstin: context.business?.gstin ?? null,
    businessAddress: context.user.billing_address,
    contactName: context.contact.name,
    contactPhone: context.contact.phone_number,
    contactGstin: context.contact.client_gstin,
    contactAddress: context.contact.billing_address,
    invoiceNumber: context.ledger.invoice_number,
    invoiceDate: formatDisplayDate(context.ledger.created_at.slice(0, 10)),
    dueDate: formatDisplayDate(context.ledger.due_date),
    totalAmount: context.ledger.total_amount,
    balanceDue: context.ledger.balance_due,
    ledgerId: context.ledger.id,
    communicationLogs: (communicationLogs ?? []).map((entry) => ({
      executed_at: entry.executed_at as string,
      type: entry.type as string,
      status: entry.status as string,
      sentiment: entry.sentiment as string | null,
      executive_summary: entry.executive_summary as string | null,
    })),
    evidenceAnnexures: evidenceAttachments.map((attachment) => ({
      file_name: attachment.file_name,
      file_type: attachment.file_type,
      uploaded_at: attachment.uploaded_at,
    })),
  });

  const pdfStoragePath = await uploadSamadhaanDocketPdf(
    context.ledger.id,
    pdfBuffer
  );

  const { error } = await supabase
    .from("ledgers")
    .update({ samadhaan_docket_pdf_url: pdfStoragePath })
    .eq("id", context.ledger.id)
    .eq("user_id", context.ledger.user_id);

  if (error) {
    throw new Error(error.message || "Failed to save Samadhaan docket path.");
  }

  return {
    purchase_type: "samadhaan_499",
    ledger_id: context.ledger.id,
    pdf_url: pdfStoragePath,
    samadhaan_meta: samadhaanMeta,
  };
}

export async function fulfillMicroTransaction(
  supabase: SupabaseClient,
  userId: string,
  ledgerId: string,
  purchaseType: Extract<PurchaseType, "legal_notice_999" | "samadhaan_499">
): Promise<MicroTransactionFulfillment> {
  const context = await loadFulfillmentContext(supabase, userId, ledgerId);

  if (!context) {
    throw new Error("Ledger not found for micro-transaction fulfillment.");
  }

  if (context.ledger.balance_due <= 0) {
    throw new Error("This ledger is already settled.");
  }

  if (purchaseType === "legal_notice_999") {
    return fulfillLegalNotice(supabase, context);
  }

  return fulfillSamadhaanKit(supabase, context);
}

async function assertSamadhaanKitAccess(
  supabase: SupabaseClient,
  userId: string,
  ledgerId: string,
  existingPdfUrl: string | null
): Promise<void> {
  if (existingPdfUrl) {
    return;
  }

  const { data: paidOrder, error } = await supabase
    .from("razorpay_orders")
    .select("id")
    .eq("user_id", userId)
    .eq("ledger_id", ledgerId)
    .eq("purchase_type", "samadhaan_499")
    .eq("status", "paid")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to verify Samadhaan purchase.");
  }

  if (!paidOrder) {
    throw new Error("Samadhaan Smart-Kit has not been purchased for this ledger.");
  }
}

export async function ensureSamadhaanDocketForLedger(
  supabase: SupabaseClient,
  userId: string,
  ledgerId: string
): Promise<MicroTransactionFulfillment> {
  const context = await loadFulfillmentContext(supabase, userId, ledgerId);

  if (!context) {
    throw new Error("Ledger not found.");
  }

  await assertSamadhaanKitAccess(
    supabase,
    userId,
    ledgerId,
    context.ledger.samadhaan_docket_pdf_url
  );

  return fulfillSamadhaanKit(supabase, context);
}

export async function getMicroFulfillmentForOrder(
  supabase: SupabaseClient,
  userId: string,
  orderId: string
): Promise<MicroTransactionFulfillment | null> {
  const { data: orderRow, error: orderError } = await supabase
    .from("razorpay_orders")
    .select("user_id, purchase_type, status, ledger_id")
    .eq("razorpay_order_id", orderId)
    .maybeSingle();

  if (orderError || !orderRow || orderRow.user_id !== userId) {
    throw new Error("Order not found.");
  }

  if (
    orderRow.purchase_type !== "legal_notice_999" &&
    orderRow.purchase_type !== "samadhaan_499"
  ) {
    return null;
  }

  if (orderRow.status !== "paid") {
    throw new Error("Order payment is not confirmed yet.");
  }

  if (!orderRow.ledger_id) {
    throw new Error("Micro-transaction order is missing ledger context.");
  }

  return fulfillMicroTransaction(
    supabase,
    userId,
    orderRow.ledger_id as string,
    orderRow.purchase_type
  );
}
