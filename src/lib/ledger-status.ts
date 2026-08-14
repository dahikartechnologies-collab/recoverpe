import { LedgerStatus, LedgerWithContact } from "@/types";

export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isLedgerPastDue(
  ledger: Pick<LedgerWithContact, "due_date">
): boolean {
  return ledger.due_date < getTodayDateString();
}

export function isLedgerDynamicallyOverdue(
  ledger: Pick<LedgerWithContact, "due_date" | "balance_due">
): boolean {
  return isLedgerPastDue(ledger) && ledger.balance_due > 0;
}

export function canInitiateAiCallForLedger(
  ledger: Pick<
    LedgerWithContact,
    "due_date" | "balance_due" | "communication_paused"
  >
): boolean {
  return (
    isLedgerPastDue(ledger) &&
    ledger.balance_due > 0 &&
    !ledger.communication_paused
  );
}

export function getDisplayLedgerStatus(
  ledger: LedgerWithContact
): LedgerStatus {
  if (["paid", "cancelled", "refunded"].includes(ledger.status)) {
    return ledger.status;
  }

  if (isLedgerDynamicallyOverdue(ledger)) {
    return "overdue";
  }

  return ledger.status;
}

export function displayStatusLabel(status: LedgerStatus): string {
  return status.replace(/_/g, " ");
}

export function displayStatusClassName(status: LedgerStatus): string {
  switch (status) {
    case "paid":
      return "text-recoverpe-success";
    case "overdue":
      return "text-recoverpe-error";
    default:
      return "text-recoverpe-grey-medium";
  }
}
