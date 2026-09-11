import { getDebtorPortalUrl, getPayPageUrl } from "@/lib/app-url";
import { formatCurrency } from "@/lib/gst";
import { formatDisplayInvoice } from "@/lib/invoice-display";
import { formatIndianPhoneNumber } from "@/lib/invoices";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { SupabaseClient } from "@supabase/supabase-js";

const PORTAL_LINK_TTL_DAYS = 7;

interface ContactRow {
  id: string;
  user_id: string;
  name: string;
  phone_number: string;
}

interface UnpaidLedgerRow {
  id: string;
  user_id: string;
  business_id: string | null;
  balance_due: number;
  due_date: string;
  created_at: string;
  invoice_number: string | null;
}

export interface BusinessDebtScope {
  contact: ContactRow;
  businessId: string | null;
  businessName: string;
  unpaidLedgers: UnpaidLedgerRow[];
}

export type InboundMessageIntent = "payment_link" | "payment_done";

export function getInboundAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (
    configured &&
    configured.includes("http") &&
    !/localhost|127\.0\.0\.1/i.test(configured)
  ) {
    return configured.replace(/\/$/, "");
  }

  return "https://www.recoverpe.com";
}

export function buildPhoneLookupCandidates(rawFrom: string): string[] {
  const digits = rawFrom.replace(/\D/g, "");
  const last10 = digits.slice(-10);

  return Array.from(
    new Set(
      [
        formatIndianPhoneNumber(rawFrom),
        formatIndianPhoneNumber(last10),
        `+91${last10}`,
        `91${last10}`,
        last10,
        digits,
      ].filter(Boolean)
    )
  );
}

export function classifyInboundMessageIntent(text: string): InboundMessageIntent {
  const normalized = text.toLowerCase().trim();

  const paidPattern =
    /\b(paid|done|already paid|payment done|transferred|transfer done|payment sent|sent payment|utr|paid already)\b/;

  if (paidPattern.test(normalized)) {
    return "payment_done";
  }

  return "payment_link";
}

export function groupLedgersByBusinessId(
  ledgers: UnpaidLedgerRow[]
): Map<string, UnpaidLedgerRow[]> {
  const grouped = new Map<string, UnpaidLedgerRow[]>();

  for (const ledger of ledgers) {
    const groupKey = ledger.business_id ?? `personal:${ledger.user_id}`;
    const existing = grouped.get(groupKey) ?? [];
    existing.push(ledger);
    grouped.set(groupKey, existing);
  }

  return grouped;
}

async function resolveBusinessName(
  supabase: SupabaseClient,
  userId: string,
  businessId: string | null
): Promise<string> {
  if (businessId) {
    const { data } = await supabase
      .from("businesses")
      .select("business_name")
      .eq("id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.business_name) {
      return data.business_name as string;
    }
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("business_name")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (business?.business_name) {
    return business.business_name as string;
  }

  const { data: user } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  return (user?.email as string | undefined)?.split("@")[0] ?? "RecoverPe";
}

async function fetchContactsByPhone(
  supabase: SupabaseClient,
  rawFrom: string
): Promise<ContactRow[]> {
  const phoneCandidates = buildPhoneLookupCandidates(rawFrom);

  const { data, error } = await supabase
    .from("contacts")
    .select("id, user_id, name, phone_number")
    .in("phone_number", phoneCandidates);

  if (error) {
    throw new Error(error.message || "Failed to lookup contact by phone.");
  }

  return (data ?? []) as ContactRow[];
}

async function fetchUnpaidLedgersForContact(
  supabase: SupabaseClient,
  contactId: string,
  businessId: string | null,
  userId: string
): Promise<UnpaidLedgerRow[]> {
  let query = supabase
    .from("ledgers")
    .select(
      "id, user_id, business_id, balance_due, due_date, created_at, invoice_number"
    )
    .eq("contact_id", contactId)
    .eq("user_id", userId)
    .gt("balance_due", 0)
    .order("created_at", { ascending: false });

  if (businessId) {
    query = query.eq("business_id", businessId);
  } else {
    query = query.is("business_id", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to fetch unpaid ledgers.");
  }

  return (data ?? []) as UnpaidLedgerRow[];
}

async function ensureDebtorPortalSession(
  supabase: SupabaseClient,
  userId: string,
  contactId: string
): Promise<string> {
  const nowIso = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("debtor_portal_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || "Failed to lookup portal session.");
  }

  if (existing?.id) {
    return existing.id as string;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + PORTAL_LINK_TTL_DAYS);

  const { data: session, error } = await supabase
    .from("debtor_portal_sessions")
    .insert({
      user_id: userId,
      contact_id: contactId,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (error || !session) {
    throw new Error(error?.message || "Failed to create portal session.");
  }

  return session.id as string;
}

export async function findBusinessDebtScopes(
  supabase: SupabaseClient,
  rawFrom: string
): Promise<BusinessDebtScope[]> {
  const contacts = await fetchContactsByPhone(supabase, rawFrom);
  const scopes: BusinessDebtScope[] = [];

  for (const contact of contacts) {
    const { data: ledgerRows, error } = await supabase
      .from("ledgers")
      .select(
        "id, user_id, business_id, balance_due, due_date, created_at, invoice_number"
      )
      .eq("contact_id", contact.id)
      .eq("user_id", contact.user_id)
      .gt("balance_due", 0)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message || "Failed to fetch unpaid ledgers.");
    }

    const grouped = groupLedgersByBusinessId((ledgerRows ?? []) as UnpaidLedgerRow[]);

    for (const [groupKey, unpaidLedgers] of Array.from(grouped.entries())) {
      if (unpaidLedgers.length === 0) {
        continue;
      }

      const businessId = groupKey.startsWith("personal:")
        ? null
        : unpaidLedgers[0]?.business_id ?? null;

      const scopedLedgers = await fetchUnpaidLedgersForContact(
        supabase,
        contact.id,
        businessId,
        contact.user_id
      );

      if (scopedLedgers.length === 0) {
        continue;
      }

      const businessName = await resolveBusinessName(
        supabase,
        contact.user_id,
        businessId
      );

      scopes.push({
        contact,
        businessId,
        businessName,
        unpaidLedgers: scopedLedgers,
      });
    }
  }

  return scopes;
}

function buildAccountSummaryReply(input: {
  contactName: string;
  businessName: string;
  totalBalance: number;
  invoiceCount: number;
  portalUrl: string;
  recentInvoiceRef: string;
  recentAmount: number;
  recentPayUrl: string;
}): string {
  return [
    `Hello ${input.contactName},`,
    "",
    `Here is your updated account summary with ${input.businessName}:`,
    "",
    `Total Outstanding Balance: *${formatCurrency(input.totalBalance)}* across ${input.invoiceCount} unpaid invoice(s).`,
    "",
    "> Pay Full Outstanding Balance:",
    input.portalUrl,
    "",
    `> Or Pay Most Recent Bill (${input.recentInvoiceRef} - ${formatCurrency(input.recentAmount)}):`,
    input.recentPayUrl,
    "",
    "Supported modes: UPI, Netbanking & Cards.",
    "- RecoverPe",
  ].join("\n");
}

function buildPaymentDoneReply(contactName: string): string {
  return [
    `Thank you, ${contactName}!`,
    "",
    "If you have already transferred the amount, please share the transaction screenshot/UTR here. Our accounts team will verify and reconcile your khata shortly.",
  ].join("\n");
}

function buildNoPendingDuesReply(input: {
  contactName: string;
  businessName: string;
  portalUrl: string;
}): string {
  return [
    `Hello ${input.contactName},`,
    "",
    `You currently have no pending dues with ${input.businessName}. All prior bills are clear!`,
    "",
    "View your account summary:",
    input.portalUrl,
    "",
    "- RecoverPe",
  ].join("\n");
}

function buildUnrecognizedNumberReply(appUrl: string): string {
  return [
    "Hello! This is an automated notification service from RecoverPe.",
    "",
    "If you need to make a payment or view your statement, please visit:",
    appUrl,
    "",
    "For help, contact your merchant directly.",
  ].join("\n");
}

export async function processInboundWhatsAppMessage(
  rawFrom: string,
  messageText: string
): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const appUrl = getInboundAppUrl();
  const intent = classifyInboundMessageIntent(messageText);
  const contacts = await fetchContactsByPhone(supabase, rawFrom);

  if (contacts.length === 0) {
    await sendWhatsAppTextMessage(rawFrom, buildUnrecognizedNumberReply(appUrl));
    return;
  }

  if (intent === "payment_done") {
    await sendWhatsAppTextMessage(
      rawFrom,
      buildPaymentDoneReply(contacts[0]?.name ?? "there")
    );
    return;
  }

  const scopes = await findBusinessDebtScopes(supabase, rawFrom);

  if (scopes.length === 0) {
    const contact = contacts[0];
    const businessName = await resolveBusinessName(supabase, contact.user_id, null);
    const portalSessionId = await ensureDebtorPortalSession(
      supabase,
      contact.user_id,
      contact.id
    );

    await sendWhatsAppTextMessage(
      rawFrom,
      buildNoPendingDuesReply({
        contactName: contact.name,
        businessName,
        portalUrl: getDebtorPortalUrl(portalSessionId),
      })
    );
    return;
  }

  for (const scope of scopes) {
    const portalSessionId = await ensureDebtorPortalSession(
      supabase,
      scope.contact.user_id,
      scope.contact.id
    );
    const portalUrl = getDebtorPortalUrl(portalSessionId);
    const recentLedger = scope.unpaidLedgers[0];
    const totalBalance = scope.unpaidLedgers.reduce(
      (sum, ledger) => sum + Number(ledger.balance_due ?? 0),
      0
    );

    await sendWhatsAppTextMessage(
      rawFrom,
      buildAccountSummaryReply({
        contactName: scope.contact.name,
        businessName: scope.businessName,
        totalBalance,
        invoiceCount: scope.unpaidLedgers.length,
        portalUrl,
        recentInvoiceRef: formatDisplayInvoice(recentLedger),
        recentAmount: Number(recentLedger.balance_due),
        recentPayUrl: getPayPageUrl(recentLedger.id),
      })
    );
  }
}
