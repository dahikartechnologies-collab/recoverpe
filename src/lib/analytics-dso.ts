import { formatInTimeZone } from "date-fns-tz";
import { daysBetweenDateOnly, RECOVERPE_TIMEZONE } from "@/lib/timezone";
import { LedgerStatus } from "@/types";

const EXCLUDED_STATUSES: LedgerStatus[] = ["paid", "cancelled", "refunded"];

export type DsoBucketKey = "0-15" | "16-30" | "31-45" | "45+";

export interface DsoCohortCell {
  percent: number;
  count: number;
}

export interface DsoCohortRow {
  monthKey: string;
  label: string;
  buckets: Record<DsoBucketKey, DsoCohortCell>;
  totalSettled: number;
}

export interface DsoCohortHeatmapData {
  columns: Array<{ key: DsoBucketKey; label: string }>;
  rows: DsoCohortRow[];
}

export interface AnalyticsDsoLedgerRow {
  id: string;
  status: LedgerStatus;
  created_at: string;
}

export interface AnalyticsDsoTransactionRow {
  ledger_id: string;
  logged_at: string;
}

function getLastFourMonthKeys(reference = new Date()): string[] {
  const keys: string[] = [];

  for (let offset = 3; offset >= 0; offset -= 1) {
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

function dateOnlyFromIso(value: string): string {
  return formatInTimeZone(new Date(value), RECOVERPE_TIMEZONE, "yyyy-MM-dd");
}

function resolveDsoBucket(daysToPay: number): DsoBucketKey {
  if (daysToPay <= 15) {
    return "0-15";
  }

  if (daysToPay <= 30) {
    return "16-30";
  }

  if (daysToPay <= 45) {
    return "31-45";
  }

  return "45+";
}

function emptyBucketCounts(): Record<DsoBucketKey, number> {
  return {
    "0-15": 0,
    "16-30": 0,
    "31-45": 0,
    "45+": 0,
  };
}

/** Builds DSO cohort heatmap rows from ledger + payment transaction data. */
export function buildDsoCohortHeatmap(
  ledgers: AnalyticsDsoLedgerRow[],
  transactions: AnalyticsDsoTransactionRow[],
  referenceDate = new Date()
): DsoCohortHeatmapData {
  const monthKeys = getLastFourMonthKeys(referenceDate);
  const columns: DsoCohortHeatmapData["columns"] = [
    { key: "0-15", label: "0–15 Days" },
    { key: "16-30", label: "16–30 Days" },
    { key: "31-45", label: "31–45 Days" },
    { key: "45+", label: "45+ Days" },
  ];

  const ledgerById = new Map(
    ledgers
      .filter((ledger) => !EXCLUDED_STATUSES.includes(ledger.status))
      .map((ledger) => [ledger.id, ledger])
  );

  const firstPaymentByLedger = new Map<string, string>();

  for (const transaction of transactions) {
    const existing = firstPaymentByLedger.get(transaction.ledger_id);

    if (!existing || new Date(transaction.logged_at) < new Date(existing)) {
      firstPaymentByLedger.set(transaction.ledger_id, transaction.logged_at);
    }
  }

  const countsByMonth = new Map<string, Record<DsoBucketKey, number>>(
    monthKeys.map((monthKey) => [monthKey, emptyBucketCounts()])
  );

  for (const [ledgerId, paidAt] of Array.from(firstPaymentByLedger.entries())) {
    const ledger = ledgerById.get(ledgerId);

    if (!ledger) {
      continue;
    }

    const invoiceMonth = monthKeyFromIsoTimestamp(ledger.created_at);

    if (!countsByMonth.has(invoiceMonth)) {
      continue;
    }

    const invoiceDate = dateOnlyFromIso(ledger.created_at);
    const paymentDate = dateOnlyFromIso(paidAt);
    const daysToPay = Math.max(0, daysBetweenDateOnly(invoiceDate, paymentDate));
    const bucket = resolveDsoBucket(daysToPay);

    const monthCounts = countsByMonth.get(invoiceMonth)!;
    monthCounts[bucket] += 1;
  }

  const rows: DsoCohortRow[] = monthKeys.map((monthKey) => {
    const bucketCounts = countsByMonth.get(monthKey) ?? emptyBucketCounts();
    const totalSettled = Object.values(bucketCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    const buckets = columns.reduce(
      (acc, column) => {
        const count = bucketCounts[column.key];
        acc[column.key] = {
          count,
          percent:
            totalSettled > 0 ? Math.round((count / totalSettled) * 100) : 0,
        };
        return acc;
      },
      {} as Record<DsoBucketKey, DsoCohortCell>
    );

    return {
      monthKey,
      label: formatMonthLabel(monthKey),
      buckets,
      totalSettled,
    };
  });

  return { columns, rows };
}
