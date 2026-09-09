import { DebtorPortalView } from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";

const OPEN_LEDGER_STATUSES = new Set([
  "draft",
  "pending",
  "partially_paid",
  "overdue",
]);

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
    .select("id, name, phone_number")
    .eq("id", session.contact_id)
    .eq("user_id", session.user_id)
    .maybeSingle();

  if (contactError || !contact) {
    return null;
  }

  const { data: ledgers, error: ledgerError } = await supabase
    .from("ledgers")
    .select(
      "id, invoice_number, balance_due, due_date, status, business_id, created_at"
    )
    .eq("user_id", session.user_id)
    .eq("contact_id", session.contact_id)
    .gt("balance_due", 0)
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (ledgerError) {
    throw new Error(ledgerError.message || "Failed to load debtor portal ledgers.");
  }

  const openLedgers = (ledgers ?? []).filter((ledger) =>
    OPEN_LEDGER_STATUSES.has(ledger.status as string)
  );

  const totalOutstanding = openLedgers.reduce(
    (sum, ledger) => sum + Number(ledger.balance_due),
    0
  );

  const businessId =
    (openLedgers.find((ledger) => ledger.business_id)?.business_id as string | null) ??
    null;

  let businessName = "Recoverpe Merchant";

  if (businessId) {
    const { data: business } = await supabase
      .from("businesses")
      .select("business_name")
      .eq("id", businessId)
      .eq("user_id", session.user_id)
      .maybeSingle();

    if (business?.business_name) {
      businessName = business.business_name as string;
    }
  } else {
    const { data: userProfile } = await supabase
      .from("users")
      .select("full_name, email")
      .eq("id", session.user_id)
      .maybeSingle();

    businessName =
      (userProfile?.full_name as string | undefined) ||
      (userProfile?.email as string | undefined) ||
      businessName;
  }

  let virtualAccountQuery = supabase
    .from("virtual_accounts")
    .select(
      "virtual_upi_id, virtual_account_number, ifsc_code, status, business_id"
    )
    .eq("user_id", session.user_id)
    .eq("contact_id", session.contact_id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (businessId) {
    virtualAccountQuery = virtualAccountQuery.eq("business_id", businessId);
  }

  const { data: virtualAccount } = await virtualAccountQuery.maybeSingle();

  return {
    session_id: session.id as string,
    merchant_name: businessName,
    contact_name: contact.name as string,
    total_outstanding: totalOutstanding,
    expires_at: session.expires_at as string,
    virtual_upi_id: (virtualAccount?.virtual_upi_id as string | null) ?? null,
    virtual_account_number:
      (virtualAccount?.virtual_account_number as string | null) ?? null,
    ifsc_code: (virtualAccount?.ifsc_code as string | null) ?? null,
    open_invoices: openLedgers.map((ledger) => ({
      id: ledger.id as string,
      invoice_number: (ledger.invoice_number as string | null) ?? null,
      balance_due: Number(ledger.balance_due),
      due_date: ledger.due_date as string,
      status: ledger.status as string,
    })),
  };
}
