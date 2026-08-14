import {
  DashboardMetrics,
  LedgerStatus,
  LedgerWithContact,
  WorkspaceMode,
} from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";

const LEDGER_SELECT = `
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
  created_at,
  updated_at,
  contacts (
    name,
    phone_number
  )
`;

type RawLedgerRow = Omit<LedgerWithContact, "contact"> & {
  contacts: { name: string; phone_number: string } | { name: string; phone_number: string }[] | null;
};

function mapLedgerRow(row: RawLedgerRow): LedgerWithContact {
  const contactData = Array.isArray(row.contacts)
    ? row.contacts[0]
    : row.contacts;
  const contact = contactData ?? { name: "Unknown", phone_number: "" };

  return {
    id: row.id,
    user_id: row.user_id,
    contact_id: row.contact_id,
    business_id: row.business_id,
    invoice_number: row.invoice_number,
    source_type: row.source_type,
    total_amount: Number(row.total_amount),
    balance_due: Number(row.balance_due),
    due_date: row.due_date,
    status: row.status,
    is_custom_pdf: row.is_custom_pdf,
    pdf_url: row.pdf_url,
    current_version: row.current_version,
    communication_paused: Boolean(row.communication_paused),
    created_at: row.created_at,
    updated_at: row.updated_at,
    contact,
  };
}

export async function fetchLedgersForWorkspace(
  supabase: SupabaseClient,
  userId: string,
  workspaceMode: WorkspaceMode,
  businessId: string | null
): Promise<LedgerWithContact[]> {
  if (workspaceMode === "business" && !businessId) {
    return [];
  }

  let query = supabase
    .from("ledgers")
    .select(LEDGER_SELECT)
    .eq("user_id", userId)
    .order("due_date", { ascending: true });

  if (workspaceMode === "personal") {
    query = query.is("business_id", null);
  } else {
    query = query.eq("business_id", businessId as string);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to load ledgers.");
  }

  return ((data ?? []) as unknown as RawLedgerRow[]).map(mapLedgerRow);
}

export async function computeDashboardMetrics(
  supabase: SupabaseClient,
  ledgers: LedgerWithContact[]
): Promise<DashboardMetrics> {
  const today = new Date().toISOString().slice(0, 10);
  const excludedStatuses: LedgerStatus[] = ["paid", "cancelled", "refunded"];

  const totalOutstanding = ledgers
    .filter(
      (ledger) =>
        ledger.balance_due > 0 && !excludedStatuses.includes(ledger.status)
    )
    .reduce((sum, ledger) => sum + ledger.balance_due, 0);

  const severelyOverdue = ledgers
    .filter((ledger) => ledger.due_date < today && ledger.balance_due > 0)
    .reduce((sum, ledger) => sum + ledger.balance_due, 0);

  const ledgerIds = ledgers.map((ledger) => ledger.id);

  if (ledgerIds.length === 0) {
    return {
      totalOutstanding,
      severelyOverdue,
      recoveredViaRecoverpe: 0,
    };
  }

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("amount")
    .eq("transaction_type", "payment_received")
    .in("ledger_id", ledgerIds);

  if (error) {
    throw new Error(error.message || "Failed to load recovery metrics.");
  }

  const recoveredViaRecoverpe = (transactions ?? []).reduce(
    (sum, transaction) => sum + Number(transaction.amount),
    0
  );

  return {
    totalOutstanding,
    severelyOverdue,
    recoveredViaRecoverpe,
  };
}

export async function fetchLedgerById(
  supabase: SupabaseClient,
  userId: string,
  ledgerId: string
): Promise<LedgerWithContact | null> {
  const { data, error } = await supabase
    .from("ledgers")
    .select(LEDGER_SELECT)
    .eq("id", ledgerId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load ledger.");
  }

  if (!data) {
    return null;
  }

  return mapLedgerRow(data as unknown as RawLedgerRow);
}
