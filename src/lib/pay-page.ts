import { createShortLivedSignedUrl } from "@/lib/firebase-storage-admin";
import { resolveLedgerDocumentPath } from "@/lib/document-storage";
import { formatCurrency } from "@/lib/gst";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { PublicPayLedgerData } from "@/types";

export async function fetchPublicPayLedger(
  ledgerId: string
): Promise<PublicPayLedgerData | null> {
  const supabase = createAdminSupabaseClient();

  const { data: ledgerRow, error: ledgerError } = await supabase
    .from("ledgers")
    .select(
      `
      id,
      invoice_number,
      balance_due,
      due_date,
      status,
      pdf_url,
      business_id,
      user_id,
      contacts (
        name
      )
    `
    )
    .eq("id", ledgerId)
    .maybeSingle();

  if (ledgerError || !ledgerRow) {
    return null;
  }

  if (
    Number(ledgerRow.balance_due) <= 0 ||
    ["paid", "cancelled", "refunded"].includes(ledgerRow.status as string)
  ) {
    return null;
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("default_upi_vpa")
    .eq("id", ledgerRow.user_id as string)
    .maybeSingle();

  const merchantVpa =
    (userRow?.default_upi_vpa as string | undefined)?.trim() ||
    process.env.DEFAULT_MERCHANT_UPI_VPA?.trim() ||
    null;

  if (!merchantVpa) {
    return null;
  }

  let businessName: string | null = null;

  if (ledgerRow.business_id) {
    const { data: businessRow } = await supabase
      .from("businesses")
      .select("business_name")
      .eq("id", ledgerRow.business_id)
      .maybeSingle();

    businessName = (businessRow?.business_name as string | undefined) ?? null;
  }

  const contactData = Array.isArray(ledgerRow.contacts)
    ? ledgerRow.contacts[0]
    : ledgerRow.contacts;

  let pdfUrl: string | null = null;

  if (ledgerRow.pdf_url) {
    const storagePath = resolveLedgerDocumentPath(
      ledgerRow.pdf_url as string,
      "invoice",
      ledgerRow.id as string
    );

    if (storagePath) {
      pdfUrl = await createShortLivedSignedUrl(storagePath);
    }
  }

  return {
    ledger_id: ledgerRow.id as string,
    contact_name: (contactData?.name as string | undefined) ?? "Customer",
    business_name: businessName,
    invoice_number: (ledgerRow.invoice_number as string | null) ?? null,
    balance_due: Number(ledgerRow.balance_due),
    due_date: ledgerRow.due_date as string,
    merchant_vpa: merchantVpa,
    pdf_url: pdfUrl,
  };
}

export function formatPayPageAmount(amount: number): string {
  return formatCurrency(amount);
}
