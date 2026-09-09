import {
  ContactDirectoryEntry,
  ContactDirectoryResponse,
  WorkspaceSearchResult,
} from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";

type RawContactDirectoryRow = {
  contact_id: string;
  contact_name: string;
  phone_number: string;
  wallet_balance: number | string;
  open_invoice_count: number | string;
  net_outstanding: number | string;
  bucket_0_30: number | string;
  bucket_31_60: number | string;
  bucket_61_90: number | string;
  bucket_90_plus: number | string;
  total_count: number | string;
};

function mapContactDirectoryRow(row: RawContactDirectoryRow): ContactDirectoryEntry {
  return {
    contact_id: row.contact_id,
    contact_name: row.contact_name,
    phone_number: row.phone_number,
    wallet_balance: Number(row.wallet_balance ?? 0),
    open_invoice_count: Number(row.open_invoice_count),
    net_outstanding: Number(row.net_outstanding),
    bucket_0_30: Number(row.bucket_0_30),
    bucket_31_60: Number(row.bucket_31_60),
    bucket_61_90: Number(row.bucket_61_90),
    bucket_90_plus: Number(row.bucket_90_plus),
  };
}

export async function fetchContactDirectory(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    contactId?: string;
    businessId?: string | null;
  }
): Promise<ContactDirectoryResponse> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const { data, error } = await supabase.rpc("get_contact_directory", {
    p_user_id: userId,
    p_limit: limit,
    p_offset: offset,
    p_contact_id: options?.contactId ?? null,
    p_business_id: options?.businessId ?? null,
  });

  if (error) {
    throw new Error(error.message || "Failed to load vendor directory.");
  }

  const rows = (data ?? []) as RawContactDirectoryRow[];
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

  const contacts = rows.map(mapContactDirectoryRow);

  return {
    contacts,
    pagination: {
      total,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      hasMore: offset + contacts.length < total,
    },
  };
}

export async function searchWorkspace(
  supabase: SupabaseClient,
  userId: string,
  query: string
): Promise<WorkspaceSearchResult[]> {
  const { data, error } = await supabase.rpc("search_workspace", {
    p_user_id: userId,
    p_search_query: query,
  });

  if (error) {
    throw new Error(error.message || "Failed to search workspace.");
  }

  if (!Array.isArray(data) && typeof data !== "object") {
    return [];
  }

  if (!Array.isArray(data) && typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as WorkspaceSearchResult[];
      return parsed.filter(
        (result) =>
          (result.type === "Contact" || result.type === "Ledger") &&
          typeof result.id === "string"
      );
    } catch {
      return [];
    }
  }

  const results = (Array.isArray(data) ? data : []) as WorkspaceSearchResult[];

  return results.filter(
    (result) =>
      (result.type === "Contact" || result.type === "Ledger") &&
      typeof result.id === "string"
  );
}

export async function fetchLedgersForContact(
  supabase: SupabaseClient,
  userId: string,
  contactId: string,
  options?: { limit?: number; offset?: number; businessId?: string | null }
): Promise<{ ledgers: import("@/types").LedgerWithContact[]; total: number }> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from("ledgers")
    .select(
      `
      id,
      user_id,
      contact_id,
      business_id,
      invoice_number,
      source_type,
      total_amount,
      balance_due,
      due_date,
      status,
      is_custom_pdf,
      pdf_url,
      current_version,
      communication_paused,
      legal_notice_pdf_url,
      samadhaan_docket_pdf_url,
      assigned_to_user_id,
      created_at,
      updated_at,
      contacts (
        name,
        phone_number
      )
    `,
      { count: "exact" }
    )
    .eq("user_id", userId)
    .eq("contact_id", contactId);

  if (options?.businessId) {
    query = query.eq("business_id", options.businessId);
  } else if (options?.businessId === null) {
    query = query.is("business_id", null);
  }

  const { data, error, count } = await query
    .order("due_date", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(error.message || "Failed to load vendor ledgers.");
  }

  type RawRow = {
    contacts:
      | { name: string; phone_number: string }
      | { name: string; phone_number: string }[]
      | null;
  } & Omit<import("@/types").LedgerWithContact, "contact">;

  const ledgers = ((data ?? []) as RawRow[]).map((row) => {
    const contactData = Array.isArray(row.contacts)
      ? row.contacts[0]
      : row.contacts;

    return {
      ...row,
      total_amount: Number(row.total_amount),
      balance_due: Number(row.balance_due),
      communication_paused: Boolean(row.communication_paused),
      legal_notice_pdf_url: row.legal_notice_pdf_url ?? null,
      samadhaan_docket_pdf_url: row.samadhaan_docket_pdf_url ?? null,
      contact: contactData ?? { name: "Unknown", phone_number: "" },
    };
  });

  return {
    ledgers,
    total: count ?? ledgers.length,
  };
}

export async function fetchWalletTransactionsForContact(
  supabase: SupabaseClient,
  userId: string,
  contactId: string
): Promise<import("@/types").WalletTransactionEntry[]> {
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .eq("user_id", userId)
    .maybeSingle();

  if (contactError) {
    throw new Error(contactError.message || "Failed to verify contact.");
  }

  if (!contact) {
    return [];
  }

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, amount, transaction_type, payment_method, reference_id, logged_at"
    )
    .eq("contact_id", contactId)
    .eq("transaction_type", "wallet_advance")
    .order("logged_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message || "Failed to load wallet transactions.");
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    amount: Number(row.amount),
    transaction_type: row.transaction_type as import("@/types").TransactionType,
    payment_method: row.payment_method as import("@/types").PaymentMethod,
    reference_id: (row.reference_id as string | null) ?? null,
    logged_at: row.logged_at as string,
  }));
}
