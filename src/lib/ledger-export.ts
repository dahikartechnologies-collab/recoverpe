import { LedgerWithContact } from "@/types";
import {
  displayStatusLabel,
  getDisplayLedgerStatus,
} from "@/lib/ledger-status";

function escapeCsvValue(value: string | number | null | undefined): string {
  const normalized = value === null || value === undefined ? "" : String(value);

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function formatExportDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function ledgersToCsv(ledgers: LedgerWithContact[]): string {
  const header = [
    "Invoice No",
    "Date",
    "Vendor",
    "Amount",
    "Balance",
    "Status",
  ];

  const rows = ledgers.map((ledger) => [
    escapeCsvValue(ledger.invoice_number ?? "—"),
    escapeCsvValue(formatExportDate(ledger.due_date)),
    escapeCsvValue(ledger.contact.name),
    escapeCsvValue(ledger.total_amount),
    escapeCsvValue(ledger.balance_due),
    escapeCsvValue(displayStatusLabel(getDisplayLedgerStatus(ledger))),
  ]);

  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

export function downloadLedgersCsv(
  ledgers: LedgerWithContact[],
  filename: string
): void {
  const csv = ledgersToCsv(ledgers);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
