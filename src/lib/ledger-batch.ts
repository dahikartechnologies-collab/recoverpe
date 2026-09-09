import { formatIndianPhoneNumber } from "@/lib/invoices";
import { countUserLedgers } from "@/lib/razorpay";
import { FREE_PLAN_LEDGER_LIMIT } from "@/lib/razorpay-products";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { MappedImportRow, WorkspaceMode } from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";

interface BatchImportInput {
  userId: string;
  rows: MappedImportRow[];
  workspaceMode: WorkspaceMode;
  businessId: string | null;
}

interface ExistingLedgerRow {
  id: string;
  invoice_number: string;
  total_amount: number;
  balance_due: number;
}

export interface BatchImportResult {
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  contact_count: number;
}

async function upsertContactForBatch(
  supabase: SupabaseClient,
  userId: string,
  contactName: string,
  phoneNumber: string
): Promise<string> {
  const formattedPhone = formatIndianPhoneNumber(phoneNumber);

  const { data: existingContact, error: lookupError } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", userId)
    .eq("phone_number", formattedPhone)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message || "Failed to lookup contact.");
  }

  if (existingContact) {
    const { error: updateError } = await supabase
      .from("contacts")
      .update({ name: contactName.trim() })
      .eq("id", existingContact.id);

    if (updateError) {
      throw new Error(updateError.message || "Failed to update contact.");
    }

    return existingContact.id as string;
  }

  const { data: createdContact, error: createError } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      name: contactName.trim(),
      phone_number: formattedPhone,
    })
    .select("id")
    .single();

  if (createError || !createdContact) {
    throw new Error(createError?.message || "Failed to create contact.");
  }

  return createdContact.id as string;
}

function resolveExistingLedgerKey(
  workspaceMode: WorkspaceMode,
  businessId: string | null,
  invoiceNumber: string | null | undefined
): string | null {
  if (workspaceMode !== "business" || !businessId) {
    return null;
  }

  const normalizedInvoiceNumber = invoiceNumber?.trim();

  if (!normalizedInvoiceNumber) {
    return null;
  }

  return normalizedInvoiceNumber;
}

export async function importLedgerBatch({
  userId,
  rows,
  workspaceMode,
  businessId,
}: BatchImportInput): Promise<BatchImportResult> {
  if (rows.length === 0) {
    throw new Error("No valid rows to import.");
  }

  const supabase = createAdminSupabaseClient();

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("subscription_plan")
    .eq("id", userId)
    .single();

  if (userError || !userRow) {
    throw new Error("User profile not found.");
  }

  if (workspaceMode === "business" && businessId) {
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    if (businessError || !business) {
      throw new Error("Business profile not found.");
    }
  }

  const dedupeInvoiceNumbers = Array.from(
    new Set(
      rows
        .map((row) =>
          resolveExistingLedgerKey(workspaceMode, businessId, row.invoice_number)
        )
        .filter((value): value is string => Boolean(value))
    )
  );

  const existingByInvoiceNumber = new Map<string, ExistingLedgerRow>();

  if (businessId && dedupeInvoiceNumbers.length > 0) {
    const { data: existingLedgers, error: existingError } = await supabase
      .from("ledgers")
      .select("id, invoice_number, total_amount, balance_due")
      .eq("user_id", userId)
      .eq("business_id", businessId)
      .in("invoice_number", dedupeInvoiceNumbers);

    if (existingError) {
      throw new Error(existingError.message || "Failed to lookup existing invoices.");
    }

    for (const ledger of existingLedgers ?? []) {
      if (ledger.invoice_number) {
        existingByInvoiceNumber.set(ledger.invoice_number, ledger as ExistingLedgerRow);
      }
    }
  }

  const projectedInsertCount = rows.filter((row) => {
    const invoiceKey = resolveExistingLedgerKey(
      workspaceMode,
      businessId,
      row.invoice_number
    );

    return !(invoiceKey && existingByInvoiceNumber.has(invoiceKey));
  }).length;

  if (userRow.subscription_plan === "free") {
    const ledgerCount = await countUserLedgers(supabase, userId);

    if (ledgerCount + projectedInsertCount > FREE_PLAN_LEDGER_LIMIT) {
      const remaining = Math.max(FREE_PLAN_LEDGER_LIMIT - ledgerCount, 0);
      throw new BatchLimitError(
        `This import would create ${projectedInsertCount} new invoice(s) but your free plan only allows ${remaining} more. Upgrade to Premium to import the full batch.`,
        {
          upgrade_required: true,
          ledger_count: ledgerCount,
          ledger_limit: FREE_PLAN_LEDGER_LIMIT,
          requested_count: projectedInsertCount,
          remaining_slots: remaining,
        }
      );
    }
  }

  const contactCache = new Map<string, string>();
  const ledgerInserts: Array<{
    user_id: string;
    contact_id: string;
    business_id: string | null;
    invoice_number: string | null;
    source_type: "tally_import";
    total_amount: number;
    balance_due: number;
    due_date: string;
    status: "pending";
    is_custom_pdf: boolean;
    pdf_url: null;
  }> = [];

  let updatedCount = 0;

  for (const row of rows) {
    const cacheKey = row.phone_number;
    let contactId = contactCache.get(cacheKey);

    if (!contactId) {
      contactId = await upsertContactForBatch(
        supabase,
        userId,
        row.contact_name,
        row.phone_number
      );
      contactCache.set(cacheKey, contactId);
    }

    const invoiceKey = resolveExistingLedgerKey(
      workspaceMode,
      businessId,
      row.invoice_number
    );
    const existingLedger =
      invoiceKey && existingByInvoiceNumber.has(invoiceKey)
        ? existingByInvoiceNumber.get(invoiceKey)
        : null;

    if (existingLedger) {
      const paidAmount = Math.max(
        0,
        existingLedger.total_amount - existingLedger.balance_due
      );
      const newBalanceDue = row.amount;
      const newTotalAmount = Math.max(
        existingLedger.total_amount,
        newBalanceDue + paidAmount
      );

      const { error: updateError } = await supabase
        .from("ledgers")
        .update({
          contact_id: contactId,
          total_amount: newTotalAmount,
          balance_due: newBalanceDue,
          due_date: row.due_date,
        })
        .eq("id", existingLedger.id)
        .eq("user_id", userId);

      if (updateError) {
        throw new Error(updateError.message || "Failed to update existing invoice.");
      }

      updatedCount += 1;
      continue;
    }

    ledgerInserts.push({
      user_id: userId,
      contact_id: contactId,
      business_id: workspaceMode === "business" ? businessId : null,
      invoice_number: invoiceKey,
      source_type: "tally_import",
      total_amount: row.amount,
      balance_due: row.amount,
      due_date: row.due_date,
      status: "pending",
      is_custom_pdf: false,
      pdf_url: null,
    });
  }

  let importedCount = 0;

  if (ledgerInserts.length > 0) {
    const { data: insertedLedgers, error: insertError } = await supabase
      .from("ledgers")
      .insert(ledgerInserts)
      .select("id");

    if (insertError || !insertedLedgers) {
      throw new Error(insertError?.message || "Failed to import ledger batch.");
    }

    importedCount = insertedLedgers.length;
  }

  return {
    imported_count: importedCount,
    updated_count: updatedCount,
    skipped_count: 0,
    contact_count: contactCache.size,
  };
}

export class BatchLimitError extends Error {
  readonly upgradeRequired = true;
  readonly details: {
    upgrade_required: true;
    ledger_count: number;
    ledger_limit: number;
    requested_count: number;
    remaining_slots: number;
  };

  constructor(
    message: string,
    details: {
      upgrade_required: true;
      ledger_count: number;
      ledger_limit: number;
      requested_count: number;
      remaining_slots: number;
    }
  ) {
    super(message);
    this.name = "BatchLimitError";
    this.details = details;
  }
}
