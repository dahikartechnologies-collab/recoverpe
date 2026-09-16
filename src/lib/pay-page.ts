import { createShortLivedSignedUrl } from "@/lib/firebase-storage-admin";
import { resolveLedgerDocumentPath } from "@/lib/document-storage";
import { formatCurrency } from "@/lib/gst";
import { provisionContactVirtualAccount } from "@/lib/payments/provision-contact-virtual-account";
import { resolveEffectiveTier } from "@/lib/entitlements";
import { resolveSmartCheckout } from "@/lib/payments/smart-checkout-router";
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
      contact_id,
      contacts (
        id,
        name,
        virtual_bank_account_number,
        virtual_ifsc_code
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

  const contactData = Array.isArray(ledgerRow.contacts)
    ? ledgerRow.contacts[0]
    : ledgerRow.contacts;

  const contactId = (contactData?.id as string | undefined) ?? (ledgerRow.contact_id as string);
  const contactName = (contactData?.name as string | undefined) ?? "Customer";

  if (contactId && !contactData?.virtual_bank_account_number) {
    try {
      await provisionContactVirtualAccount({
        userId: ledgerRow.user_id as string,
        contactId,
        contactName,
      });
    } catch (error) {
      console.error(
        "[pay-page] Virtual account provisioning failed:",
        error instanceof Error ? error.message : error
      );
    }
  }

  const { data: refreshedContact } = contactId
    ? await supabase
        .from("contacts")
        .select(
          "id, name, virtual_bank_account_number, virtual_ifsc_code"
        )
        .eq("id", contactId)
        .maybeSingle()
    : { data: null };

  const { data: userRow } = await supabase
    .from("users")
    .select("default_upi_vpa")
    .eq("id", ledgerRow.user_id as string)
    .maybeSingle();

  const merchantVpa =
    (userRow?.default_upi_vpa as string | undefined)?.trim() ||
    process.env.DEFAULT_MERCHANT_UPI_VPA?.trim() ||
    null;

  let businessName: string | null = null;
  let businessEntitlements = null;

  if (ledgerRow.business_id) {
    const { data: businessRow } = await supabase
      .from("businesses")
      .select("business_name, subscription_tier, subscription_status, addons")
      .eq("id", ledgerRow.business_id)
      .maybeSingle();

    businessName = (businessRow?.business_name as string | undefined) ?? null;
    businessEntitlements = businessRow
      ? {
          subscription_tier: businessRow.subscription_tier as never,
          subscription_status: businessRow.subscription_status as string | null,
          addons: businessRow.addons,
        }
      : null;
  }

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

  const effectiveTier = businessEntitlements
    ? resolveEffectiveTier(businessEntitlements)
    : null;

  const checkoutDecision = resolveSmartCheckout({
    amount: Number(ledgerRow.balance_due),
    ledgerId: ledgerRow.id as string,
    invoiceNumber: (ledgerRow.invoice_number as string | null) ?? null,
    business: businessEntitlements,
    businessName,
    merchantVpa,
    virtualBankAccountNumber:
      (refreshedContact?.virtual_bank_account_number as string | null) ?? null,
    virtualIfscCode:
      (refreshedContact?.virtual_ifsc_code as string | null) ?? null,
  });

  if (checkoutDecision.mode === "upi_standard" && !checkoutDecision.upi) {
    return null;
  }

  if (
    checkoutDecision.mode === "zero_mdr_bank" &&
    !checkoutDecision.bank
  ) {
    return null;
  }

  return {
    ledger_id: ledgerRow.id as string,
    contact_id: contactId,
    contact_name: contactName,
    business_name: businessName,
    invoice_number: (ledgerRow.invoice_number as string | null) ?? null,
    balance_due: Number(ledgerRow.balance_due),
    due_date: ledgerRow.due_date as string,
    merchant_vpa: merchantVpa,
    pdf_url: pdfUrl,
    business_tier: effectiveTier,
    virtual_bank_account_number:
      (refreshedContact?.virtual_bank_account_number as string | null) ?? null,
    virtual_ifsc_code:
      (refreshedContact?.virtual_ifsc_code as string | null) ?? null,
    checkout: {
      mode: checkoutDecision.mode,
      amount: checkoutDecision.amount,
      payment_reference: checkoutDecision.paymentReference,
      smart_collect_ready: checkoutDecision.smartCollectReady,
      upi: checkoutDecision.upi
        ? {
            vpa: checkoutDecision.upi.vpa,
            amount: checkoutDecision.upi.amount,
            transaction_reference: checkoutDecision.upi.transactionReference,
          }
        : undefined,
      bank: checkoutDecision.bank
        ? {
            beneficiary_name: checkoutDecision.bank.beneficiaryName,
            account_number: checkoutDecision.bank.accountNumber,
            ifsc: checkoutDecision.bank.ifsc,
            amount: checkoutDecision.bank.amount,
            payment_reference: checkoutDecision.bank.paymentReference,
          }
        : undefined,
    },
  };
}

export function formatPayPageAmount(amount: number): string {
  return formatCurrency(amount);
}
