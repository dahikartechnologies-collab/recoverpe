import { formatInTimeZone } from "date-fns-tz";
import { SupabaseClient } from "@supabase/supabase-js";
import { buildDsoCohortHeatmap, DsoCohortHeatmapData } from "@/lib/analytics-dso";
import { buildSankeyFlowFromLedgers, SankeyFlowData } from "@/lib/analytics-sankey";
import {
  daysBetweenDateOnly,
  getTodayDateStringInIst,
  RECOVERPE_TIMEZONE,
} from "@/lib/timezone";
import { LedgerStatus, WorkspaceMode } from "@/types";

const EXCLUDED_STATUSES: LedgerStatus[] = ["paid", "cancelled", "refunded"];

type AnalyticsLedgerRow = {
  id: string;
  contact_id: string;
  total_amount: number | string;
  balance_due: number | string;
  due_date: string;
  status: LedgerStatus;
  created_at: string;
  legal_notice_pdf_url?: string | null;
  samadhaan_docket_pdf_url?: string | null;
};

type AnalyticsTransactionRow = {
  ledger_id: string;
  amount: number | string;
  logged_at: string;
};

export interface DashboardAnalyticsSummary {
  totalOutstanding: number;
  collectedThisMonth: number;
  activeDefaulters: number;
  collectionRate: number;
  collectedThisMonthChangePercent: number | null;
  collectionRateChangePercent: number | null;
  totalOutstandingChangePercent: number | null;
  activeDefaultersChangePercent: number | null;
}

export interface DashboardCashFlowPoint {
  month: string;
  monthKey: string;
  expected: number;
  collected: number;
}

export interface DashboardAgingSegment {
  key: "0-30" | "31-60" | "61+";
  label: string;
  amount: number;
}

export interface DashboardAnalytics {
  summary: DashboardAnalyticsSummary;
  cashFlow: DashboardCashFlowPoint[];
  aging: DashboardAgingSegment[];
  sankey: SankeyFlowData;
  dsoCohort: DsoCohortHeatmapData;
}

export const EMPTY_DASHBOARD_ANALYTICS: DashboardAnalytics = {
  summary: {
    totalOutstanding: 0,
    collectedThisMonth: 0,
    activeDefaulters: 0,
    collectionRate: 0,
    collectedThisMonthChangePercent: null,
    collectionRateChangePercent: null,
    totalOutstandingChangePercent: null,
    activeDefaultersChangePercent: null,
  },
  cashFlow: [],
  aging: [
    { key: "0-30", label: "0–30 days", amount: 0 },
    { key: "31-60", label: "31–60 days", amount: 0 },
    { key: "61+", label: "61+ days", amount: 0 },
  ],
  sankey: buildSankeyFlowFromLedgers([]),
  dsoCohort: buildDsoCohortHeatmap([], []),
};

function getLastTwelveMonthKeys(reference = new Date()): string[] {
  const keys: string[] = [];

  for (let offset = 11; offset >= 0; offset -= 1) {
    const date = new Date(reference);
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - offset);
    keys.push(formatInTimeZone(date, RECOVERPE_TIMEZONE, "yyyy-MM"));
  }

  return keys;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));

  return formatInTimeZone(date, RECOVERPE_TIMEZONE, "MMM yyyy");
}

function monthKeyFromIsoTimestamp(value: string): string {
  return formatInTimeZone(new Date(value), RECOVERPE_TIMEZONE, "yyyy-MM");
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null;
  }

  return Math.round(((current - previous) / previous) * 100);
}

function collectionRateForMonth(
  expected: number,
  collected: number
): number {
  if (expected > 0) {
    return Math.min(100, Math.round((collected / expected) * 100));
  }

  return collected > 0 ? 100 : 0;
}

const ANALYTICS_PAGE_SIZE = 1000;

async function fetchAllQueryRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message?: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await fetchPage(from, from + ANALYTICS_PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message || "Failed to load analytics rows.");
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < ANALYTICS_PAGE_SIZE) {
      break;
    }

    from += ANALYTICS_PAGE_SIZE;
  }

  return rows;
}

async function fetchAnalyticsLedgers(
  supabase: SupabaseClient,
  userId: string,
  workspaceMode: WorkspaceMode,
  businessId: string | null,
  assignedToUserId?: string | null
): Promise<AnalyticsLedgerRow[]> {
  if (workspaceMode === "business" && !businessId) {
    return [];
  }

  return fetchAllQueryRows<AnalyticsLedgerRow>(async (from, to) => {
    let query = supabase
      .from("ledgers")
      .select(
        "id, contact_id, total_amount, balance_due, due_date, status, created_at, legal_notice_pdf_url, samadhaan_docket_pdf_url"
      )
      .eq("user_id", userId)
      .range(from, to);

    if (workspaceMode === "personal") {
      query = query.is("business_id", null);
    } else {
      query = query.eq("business_id", businessId as string);
    }

    if (assignedToUserId) {
      query = query.eq("assigned_to_user_id", assignedToUserId);
    }

    const { data, error } = await query;
    return { data: data as AnalyticsLedgerRow[] | null, error };
  });
}

async function fetchAnalyticsTransactions(
  supabase: SupabaseClient,
  userId: string,
  workspaceMode: WorkspaceMode,
  businessId: string | null,
  assignedToUserId?: string | null
): Promise<AnalyticsTransactionRow[]> {
  if (workspaceMode === "business" && !businessId) {
    return [];
  }

  return fetchAllQueryRows<AnalyticsTransactionRow>(async (from, to) => {
    let query = supabase
      .from("transactions")
      .select(
        "ledger_id, amount, logged_at, ledgers!inner(user_id, business_id, assigned_to_user_id)"
      )
      .eq("transaction_type", "payment_received")
      .eq("ledgers.user_id", userId)
      .range(from, to);

    if (workspaceMode === "personal") {
      query = query.is("ledgers.business_id", null);
    } else {
      query = query.eq("ledgers.business_id", businessId as string);
    }

    if (assignedToUserId) {
      query = query.eq("ledgers.assigned_to_user_id", assignedToUserId);
    }

    const { data, error } = await query;

    return {
      data: (data ?? []).map((row) => ({
        ledger_id: row.ledger_id as string,
        amount: row.amount as number | string,
        logged_at: row.logged_at as string,
      })),
      error,
    };
  });
}

export function buildDashboardAnalytics(
  ledgers: AnalyticsLedgerRow[],
  transactions: AnalyticsTransactionRow[],
  referenceDate = new Date()
): DashboardAnalytics {
  const today = getTodayDateStringInIst(referenceDate);
  const currentMonthKey = formatInTimeZone(referenceDate, RECOVERPE_TIMEZONE, "yyyy-MM");
  const monthKeys = getLastTwelveMonthKeys(referenceDate);
  const summaryMonthKeys = monthKeys.slice(-6);

  const expectedByMonth = new Map<string, number>(
    monthKeys.map((monthKey) => [monthKey, 0])
  );
  const collectedByMonth = new Map<string, number>(
    monthKeys.map((monthKey) => [monthKey, 0])
  );

  let totalOutstanding = 0;
  let collectedThisMonth = 0;
  const defaulterContacts = new Set<string>();

  const agingAmounts: Record<DashboardAgingSegment["key"], number> = {
    "0-30": 0,
    "31-60": 0,
    "61+": 0,
  };

  for (const ledger of ledgers) {
    const balanceDue = Number(ledger.balance_due);
    const totalAmount = Number(ledger.total_amount);
    const createdMonthKey = monthKeyFromIsoTimestamp(ledger.created_at);

    if (expectedByMonth.has(createdMonthKey)) {
      expectedByMonth.set(
        createdMonthKey,
        (expectedByMonth.get(createdMonthKey) ?? 0) + totalAmount
      );
    }

    if (
      balanceDue > 0 &&
      !EXCLUDED_STATUSES.includes(ledger.status)
    ) {
      totalOutstanding += balanceDue;

      const daysOverdue = Math.max(0, daysBetweenDateOnly(ledger.due_date, today));

      if (daysOverdue <= 30) {
        agingAmounts["0-30"] += balanceDue;
      } else if (daysOverdue <= 60) {
        agingAmounts["31-60"] += balanceDue;
      } else {
        agingAmounts["61+"] += balanceDue;
      }

      if (ledger.due_date < today) {
        defaulterContacts.add(ledger.contact_id);
      }
    }
  }

  for (const transaction of transactions) {
    const amount = Number(transaction.amount);
    const monthKey = monthKeyFromIsoTimestamp(transaction.logged_at);

    if (collectedByMonth.has(monthKey)) {
      collectedByMonth.set(
        monthKey,
        (collectedByMonth.get(monthKey) ?? 0) + amount
      );
    }

    if (monthKey === currentMonthKey) {
      collectedThisMonth += amount;
    }
  }

  const expectedThisMonth = expectedByMonth.get(currentMonthKey) ?? 0;
  const collectionRate = collectionRateForMonth(
    expectedThisMonth,
    collectedThisMonth
  );

  const previousMonthKey = summaryMonthKeys[summaryMonthKeys.length - 2] ?? null;
  const collectedPreviousMonth = previousMonthKey
    ? (collectedByMonth.get(previousMonthKey) ?? 0)
    : 0;
  const expectedPreviousMonth = previousMonthKey
    ? (expectedByMonth.get(previousMonthKey) ?? 0)
    : 0;
  const previousCollectionRate = collectionRateForMonth(
    expectedPreviousMonth,
    collectedPreviousMonth
  );

  return {
    summary: {
      totalOutstanding,
      collectedThisMonth,
      activeDefaulters: defaulterContacts.size,
      collectionRate,
      collectedThisMonthChangePercent: percentChange(
        collectedThisMonth,
        collectedPreviousMonth
      ),
      collectionRateChangePercent:
        previousMonthKey !== null
          ? percentChange(collectionRate, previousCollectionRate)
          : null,
      totalOutstandingChangePercent: null,
      activeDefaultersChangePercent: null,
    },
    cashFlow: monthKeys.map((monthKey) => ({
      monthKey,
      month: formatMonthLabel(monthKey),
      expected: expectedByMonth.get(monthKey) ?? 0,
      collected: collectedByMonth.get(monthKey) ?? 0,
    })),
    aging: [
      { key: "0-30", label: "0–30 days", amount: agingAmounts["0-30"] },
      { key: "31-60", label: "31–60 days", amount: agingAmounts["31-60"] },
      { key: "61+", label: "61+ days", amount: agingAmounts["61+"] },
    ],
    sankey: buildSankeyFlowFromLedgers(ledgers, referenceDate),
    dsoCohort: buildDsoCohortHeatmap(ledgers, transactions, referenceDate),
  };
}

async function fetchAnalyticsTransactionsByLedgerIds(
  supabase: SupabaseClient,
  ledgerIds: string[]
): Promise<AnalyticsTransactionRow[]> {
  if (ledgerIds.length === 0) {
    return [];
  }

  const chunkSize = 150;
  const chunks: string[][] = [];

  for (let index = 0; index < ledgerIds.length; index += chunkSize) {
    chunks.push(ledgerIds.slice(index, index + chunkSize));
  }

  const pages = await Promise.all(
    chunks.map(async (chunk) => {
      const { data, error } = await supabase
        .from("transactions")
        .select("ledger_id, amount, logged_at")
        .eq("transaction_type", "payment_received")
        .in("ledger_id", chunk);

      if (error) {
        throw new Error(error.message || "Failed to load analytics transactions.");
      }

      return (data ?? []) as AnalyticsTransactionRow[];
    })
  );

  return pages.flat();
}

export async function fetchDashboardAnalytics(
  supabase: SupabaseClient,
  userId: string,
  workspaceMode: WorkspaceMode,
  businessId: string | null,
  assignedToUserId?: string | null
): Promise<DashboardAnalytics> {
  try {
    const [ledgers, transactions] = await Promise.all([
      fetchAnalyticsLedgers(
        supabase,
        userId,
        workspaceMode,
        businessId,
        assignedToUserId
      ),
      fetchAnalyticsTransactions(
        supabase,
        userId,
        workspaceMode,
        businessId,
        assignedToUserId
      ),
    ]);

    return buildDashboardAnalytics(ledgers, transactions);
  } catch {
    const ledgers = await fetchAnalyticsLedgers(
      supabase,
      userId,
      workspaceMode,
      businessId,
      assignedToUserId
    );
    const transactions = await fetchAnalyticsTransactionsByLedgerIds(
      supabase,
      ledgers.map((ledger) => ledger.id)
    );

    return buildDashboardAnalytics(ledgers, transactions);
  }
}
