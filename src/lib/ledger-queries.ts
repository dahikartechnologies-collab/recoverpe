import {
  DashboardMetrics,
  LedgerStatus,
  LedgerWithContact,
  PaymentReliabilityTier,
  WorkspaceMode,
} from "@/types";
import { fetchDashboardMetricsViaRpc } from "@/lib/dashboard-intelligence";
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
  legal_notice_pdf_url,
  samadhaan_docket_pdf_url,
  assigned_to_user_id,
  created_at,
  updated_at,
  contacts (
    name,
    phone_number,
    risk_score,
    payment_reliability_tier,
    predicted_pay_date
  )
`;

type RawLedgerRow = Omit<LedgerWithContact, "contact"> & {
  contacts:
    | {
        name: string;
        phone_number: string;
        risk_score?: number | null;
        payment_reliability_tier?: PaymentReliabilityTier | null;
        predicted_pay_date?: string | null;
      }
    | {
        name: string;
        phone_number: string;
        risk_score?: number | null;
        payment_reliability_tier?: PaymentReliabilityTier | null;
        predicted_pay_date?: string | null;
      }[]
    | null;
};

export const LEDGER_PAGE_SIZE = 50;
export const LEDGER_PAGE_SIZE_MAX = 100;

export interface LedgerPaginationParams {
  limit?: number;
  offset?: number;
  assignedToUserId?: string | null;
}

export interface PaginatedLedgersResult {
  ledgers: LedgerWithContact[];
  total: number;
  limit: number;
  offset: number;
}

function normalizeLedgerPagination(
  pagination?: LedgerPaginationParams
): { limit: number; offset: number } {
  const limit = Math.min(
    Math.max(pagination?.limit ?? LEDGER_PAGE_SIZE, 1),
    LEDGER_PAGE_SIZE_MAX
  );
  const offset = Math.max(pagination?.offset ?? 0, 0);

  return { limit, offset };
}

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
    legal_notice_pdf_url: (row.legal_notice_pdf_url as string | null) ?? null,
    samadhaan_docket_pdf_url:
      (row.samadhaan_docket_pdf_url as string | null) ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    contact: {
      name: contact.name,
      phone_number: contact.phone_number,
      risk_score:
        contact.risk_score !== null && contact.risk_score !== undefined
          ? Number(contact.risk_score)
          : 50,
      payment_reliability_tier:
        (contact.payment_reliability_tier as PaymentReliabilityTier | null) ??
        "good",
      predicted_pay_date: contact.predicted_pay_date ?? null,
    },
  };
}

export async function fetchLedgersForWorkspace(
  supabase: SupabaseClient,
  userId: string,
  workspaceMode: WorkspaceMode,
  businessId: string | null,
  pagination?: LedgerPaginationParams
): Promise<PaginatedLedgersResult> {
  if (workspaceMode === "business" && !businessId) {
    return {
      ledgers: [],
      total: 0,
      limit: pagination?.limit ?? LEDGER_PAGE_SIZE,
      offset: pagination?.offset ?? 0,
    };
  }

  const { limit, offset } = normalizeLedgerPagination(pagination);

  let query = supabase
    .from("ledgers")
    .select(LEDGER_SELECT, { count: "exact" })
    .eq("user_id", userId)
    .order("due_date", { ascending: true })
    .range(offset, offset + limit - 1);

  if (workspaceMode === "personal") {
    query = query.is("business_id", null);
  } else {
    query = query.eq("business_id", businessId as string);
  }

  if (pagination?.assignedToUserId) {
    query = query.eq("assigned_to_user_id", pagination.assignedToUserId);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message || "Failed to load ledgers.");
  }

  return {
    ledgers: ((data ?? []) as unknown as RawLedgerRow[]).map(mapLedgerRow),
    total: count ?? 0,
    limit,
    offset,
  };
}

export async function computeDashboardMetrics(
  supabase: SupabaseClient,
  userId: string,
  workspaceMode: WorkspaceMode,
  businessId: string | null,
  ledgers: LedgerWithContact[],
  options?: { forceFallback?: boolean; assignedToUserId?: string | null }
): Promise<DashboardMetrics> {
  const assignedToUserId = options?.assignedToUserId ?? null;

  try {
    return await fetchDashboardMetricsViaRpc(
      supabase,
      userId,
      workspaceMode,
      businessId,
      assignedToUserId
    );
  } catch (rpcError) {
    console.error("[dashboard-metrics] RPC failed:", rpcError);
  }

  try {
    return await computeDashboardMetricsFromDb(
      supabase,
      userId,
      workspaceMode,
      businessId,
      assignedToUserId
    );
  } catch (dbError) {
    console.error("[dashboard-metrics] Count aggregation failed:", dbError);
    return computeDashboardMetricsFallback(ledgers);
  }
}

async function computeDashboardMetricsFromDb(
  supabase: SupabaseClient,
  userId: string,
  workspaceMode: WorkspaceMode,
  businessId: string | null,
  assignedToUserId: string | null
): Promise<DashboardMetrics> {
  const applyLedgerScope = (query: Record<string, unknown>) => {
    const builder = query as {
      eq: (column: string, value: string) => unknown;
      is: (column: string, value: null) => unknown;
    };
    let scoped: unknown = builder.eq("user_id", userId);

    if (workspaceMode === "personal") {
      scoped = (scoped as typeof builder).is("business_id", null);
    } else {
      scoped = (scoped as typeof builder).eq("business_id", businessId as string);
    }

    if (assignedToUserId) {
      scoped = (scoped as typeof builder).eq(
        "assigned_to_user_id",
        assignedToUserId
      );
    }

    return scoped as Promise<{
      data: unknown;
      error: { message?: string } | null;
    }>;
  };

  const outstandingBase = supabase
    .from("ledgers")
    .select("balance_due")
    .gt("balance_due", 0)
    .not("status", "in", "(paid,cancelled,refunded)");
  const overdueBase = supabase
    .from("ledgers")
    .select("balance_due")
    .gt("balance_due", 0)
    .not("status", "in", "(paid,cancelled,refunded)")
    .lt("due_date", new Date().toISOString().slice(0, 10));
  const recoveredBase = supabase
    .from("transactions")
    .select("amount, ledgers!inner(user_id, business_id, assigned_to_user_id)")
    .eq("transaction_type", "payment_received")
    .eq("ledgers.user_id", userId);

  const [outstanding, overdue, recovered] = await Promise.all([
    applyLedgerScope(outstandingBase as unknown as Record<string, unknown>),
    applyLedgerScope(overdueBase as unknown as Record<string, unknown>),
    (async () => {
      let scoped: unknown = recoveredBase;

      if (workspaceMode === "personal") {
        scoped = (
          scoped as { is: (column: string, value: null) => unknown }
        ).is("ledgers.business_id", null);
      } else {
        scoped = (
          scoped as { eq: (column: string, value: string) => unknown }
        ).eq("ledgers.business_id", businessId as string);
      }

      if (assignedToUserId) {
        scoped = (
          scoped as { eq: (column: string, value: string) => unknown }
        ).eq("ledgers.assigned_to_user_id", assignedToUserId);
      }

      return scoped as Promise<{
        data: unknown;
        error: { message?: string } | null;
      }>;
    })(),
  ]);

  if (outstanding.error) {
    throw new Error(outstanding.error.message);
  }

  if (overdue.error) {
    throw new Error(overdue.error.message);
  }

  if (recovered.error) {
    throw new Error(recovered.error.message);
  }

  const readSum = (data: unknown, column: "balance_due" | "amount"): number => {
    const rows = Array.isArray(data) ? data : [];
    return rows.reduce((total, row) => {
      if (!row || typeof row !== "object") {
        return total;
      }

      const value = Number((row as Record<string, unknown>)[column]);
      return total + (Number.isFinite(value) ? value : 0);
    }, 0);
  };

  return {
    totalOutstanding: readSum(outstanding.data, "balance_due"),
    severelyOverdue: readSum(overdue.data, "balance_due"),
    recoveredViaRecoverpe: readSum(recovered.data, "amount"),
  };
}

function computeDashboardMetricsFallback(
  ledgers: LedgerWithContact[]
): DashboardMetrics {
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

  return {
    totalOutstanding,
    severelyOverdue,
    recoveredViaRecoverpe: 0,
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
