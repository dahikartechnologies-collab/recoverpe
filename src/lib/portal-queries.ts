import { DebtorPortalInvoice, DebtorPortalView } from "@/types";
import { resolveEffectiveTier } from "@/lib/entitlements";
import { provisionContactVirtualAccount } from "@/lib/payments/provision-contact-virtual-account";
import { resolveSmartCheckout } from "@/lib/payments/smart-checkout-router";
import { SupabaseClient } from "@supabase/supabase-js";

const OPEN_LEDGER_STATUSES = new Set([
  "draft",
  "pending",
  "partially_paid",
  "overdue",
]);

function toPortalInvoice(ledger: Record<string, unknown>): DebtorPortalInvoice {
  const totalAmount = Number(ledger.total_amount ?? 0);
  const balanceDue = Number(ledger.balance_due ?? 0);

  return {
    id: ledger.id as string,
    invoice_number: (ledger.invoice_number as string | null) ?? null,
    balance_due: balanceDue,
    due_date: ledger.due_date as string,
    status: ledger.status as string,
    total_amount: totalAmount,
    amount_paid: Math.max(totalAmount - balanceDue, 0),
  };
}

export async function fetchDebtorPortalPaymentStatus(
  supabase: SupabaseClient,
  token: string
): Promise<{
  session_id: string;
  total_outstanding: number;
  is_settled: boolean;
  is_paid: boolean;
} | null> {
  const view = await fetchDebtorPortalView(supabase, token);

  if (!view) {
    return null;
  }

  return {
    session_id: view.session_id,
    total_outstanding: view.total_outstanding,
    is_settled: view.total_outstanding <= 0,
    is_paid: view.total_outstanding <= 0,
  };
}

export async function fetchDebtorPortalView(
  supabase: SupabaseClient,
  token: string
): Promise<DebtorPortalView | null> {
  const sessionId = token.trim();

  if (!sessionId) {
    return null;
  }

  const { data: session, error: sessionError } = await supabase
    .from("debtor_portal_sessions")
    .select("id, user_id, contact_id, expires_at, revoked_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return null;
  }

  if (session.revoked_at) {
    return null;
  }

  const expiresAt = new Date(session.expires_at as string);

  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return null;
  }

  await supabase
    .from("debtor_portal_sessions")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", session.id);

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select(
      "id, name, phone_number, virtual_upi_id, virtual_bank_account_number, virtual_ifsc_code"
    )
    .eq("id", session.contact_id)
    .eq("user_id", session.user_id)
    .maybeSingle();

  if (contactError || !contact) {
    return null;
  }

  if (!contact.virtual_bank_account_number) {
    try {
      await provisionContactVirtualAccount({
        userId: session.user_id as string,
        contactId: contact.id as string,
        contactName: contact.name as string,
      });
    } catch (error) {
      console.error(
        "[portal] Virtual account provisioning failed:",
        error instanceof Error ? error.message : error
      );
    }
  }

  const { data: refreshedContact } = await supabase
    .from("contacts")
    .select(
      "id, name, phone_number, virtual_upi_id, virtual_bank_account_number, virtual_ifsc_code"
    )
    .eq("id", session.contact_id)
    .eq("user_id", session.user_id)
    .maybeSingle();

  const contactRow = refreshedContact ?? contact;

  const { data: ledgers, error: ledgerError } = await supabase
    .from("ledgers")
    .select(
      "id, invoice_number, total_amount, balance_due, due_date, status, business_id, created_at"
    )
    .eq("user_id", session.user_id)
    .eq("contact_id", session.contact_id)
    .order("due_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (ledgerError) {
    throw new Error(ledgerError.message || "Failed to load debtor portal ledgers.");
  }

  const allLedgers = ledgers ?? [];

  const openLedgers = allLedgers
    .filter(
      (ledger) =>
        Number(ledger.balance_due) > 0 &&
        OPEN_LEDGER_STATUSES.has(ledger.status as string)
    )
    .sort((first, second) =>
      String(first.due_date).localeCompare(String(second.due_date))
    );

  const totalOutstanding = openLedgers.reduce(
    (sum, ledger) => sum + Number(ledger.balance_due),
    0
  );

  const totalInvoiced = allLedgers.reduce(
    (sum, ledger) => sum + Number(ledger.total_amount ?? 0),
    0
  );

  const totalPaid = allLedgers.reduce(
    (sum, ledger) =>
      sum + Math.max(Number(ledger.total_amount ?? 0) - Number(ledger.balance_due), 0),
    0
  );

  const primaryLedger = openLedgers[0] ?? null;

  const businessId =
    (primaryLedger?.business_id as string | null) ??
    (openLedgers.find((ledger) => ledger.business_id)?.business_id as string | null) ??
    null;

  let businessName = "Recoverpe Merchant";
  let businessEntitlements = null;

  if (businessId) {
    const { data: business } = await supabase
      .from("businesses")
      .select("business_name, subscription_tier, subscription_status, addons")
      .eq("id", businessId)
      .eq("user_id", session.user_id)
      .maybeSingle();

    if (business?.business_name) {
      businessName = business.business_name as string;
    }

    businessEntitlements = business
      ? {
          subscription_tier: business.subscription_tier as never,
          subscription_status: business.subscription_status as string | null,
          addons: business.addons,
        }
      : null;
  } else {
    const { data: userProfile } = await supabase
      .from("users")
      .select("full_name, email, default_upi_vpa")
      .eq("id", session.user_id)
      .maybeSingle();

    businessName =
      (userProfile?.full_name as string | undefined) ||
      (userProfile?.email as string | undefined) ||
      businessName;
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("default_upi_vpa")
    .eq("id", session.user_id)
    .maybeSingle();

  const merchantVpa =
    (userRow?.default_upi_vpa as string | undefined)?.trim() ||
    process.env.DEFAULT_MERCHANT_UPI_VPA?.trim() ||
    (contactRow.virtual_upi_id as string | null) ||
    null;

  const effectiveTier = businessEntitlements
    ? resolveEffectiveTier(businessEntitlements)
    : null;

  const checkoutDecision = resolveSmartCheckout({
    amount: totalOutstanding,
    ledgerId: (primaryLedger?.id as string) ?? session.id,
    invoiceNumber: (primaryLedger?.invoice_number as string | null) ?? null,
    business: businessEntitlements,
    businessName,
    merchantVpa,
    virtualBankAccountNumber:
      (contactRow.virtual_bank_account_number as string | null) ?? null,
    virtualIfscCode: (contactRow.virtual_ifsc_code as string | null) ?? null,
  });

  return {
    session_id: session.id as string,
    merchant_name: businessName,
    contact_name: contactRow.name as string,
    total_outstanding: totalOutstanding,
    expires_at: session.expires_at as string,
    virtual_upi_id: (contactRow.virtual_upi_id as string | null) ?? merchantVpa,
    virtual_account_number:
      (contactRow.virtual_bank_account_number as string | null) ?? null,
    ifsc_code: (contactRow.virtual_ifsc_code as string | null) ?? null,
    open_invoices: openLedgers.map(toPortalInvoice),
    total_invoiced: totalInvoiced,
    total_paid: totalPaid,
    invoice_history: allLedgers.map(toPortalInvoice),
    primary_ledger_id: (primaryLedger?.id as string | null) ?? null,
    business_tier: effectiveTier,
    merchant_vpa: merchantVpa,
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
