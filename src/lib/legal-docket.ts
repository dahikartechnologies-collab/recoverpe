import { formatPdfTimestampIst } from "@/components/pdf/pdf-shared";
import { LegalDocketPDFProps } from "@/components/pdf/LegalDocketPDF";
import { fetchEvidenceForLedger } from "@/lib/evidence-queries";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { SupabaseClient } from "@supabase/supabase-js";

async function fetchBusinessForLedger(
  supabase: SupabaseClient,
  userId: string,
  businessId: string | null
) {
  if (!businessId) {
    const { data: userProfile } = await supabase
      .from("users")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle();

    return {
      business_name:
        (userProfile?.full_name as string | undefined) ||
        (userProfile?.email as string | undefined) ||
        "Recoverpe Merchant",
      gstin: null as string | null,
      business_address: null as string | null,
    };
  }

  const { data: business, error } = await supabase
    .from("businesses")
    .select("business_name, gstin, business_address")
    .eq("id", businessId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !business) {
    throw new Error("Business profile not found for this ledger.");
  }

  return {
    business_name: business.business_name as string,
    gstin: (business.gstin as string | null) ?? null,
    business_address: (business.business_address as string | null) ?? null,
  };
}

export async function buildLegalDocketPdfProps(
  supabase: SupabaseClient,
  userId: string,
  ledgerId: string
): Promise<LegalDocketPDFProps> {
  const ledger = await fetchLedgerById(supabase, userId, ledgerId);

  if (!ledger) {
    throw new Error("Ledger not found.");
  }

  const business = await fetchBusinessForLedger(
    supabase,
    userId,
    ledger.business_id
  );
  const evidence = await fetchEvidenceForLedger(supabase, userId, ledgerId);

  const { data: contactRow } = await supabase
    .from("contacts")
    .select("client_gstin")
    .eq("id", ledger.contact_id)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    generatedAt: formatPdfTimestampIst(new Date().toISOString()),
    businessName: business.business_name,
    businessGstin: business.gstin,
    businessAddress: business.business_address,
    contactName: ledger.contact.name,
    contactPhone: ledger.contact.phone_number,
    contactGstin: (contactRow?.client_gstin as string | null) ?? null,
    invoiceNumber: ledger.invoice_number,
    invoiceDate: ledger.created_at.slice(0, 10),
    dueDate: ledger.due_date,
    totalAmount: ledger.total_amount,
    balanceDue: ledger.balance_due,
    annexures: evidence.map((attachment) => ({
      file_name: attachment.file_name,
    })),
  };
}
