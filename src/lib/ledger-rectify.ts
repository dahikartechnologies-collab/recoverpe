import { SupabaseClient } from "@supabase/supabase-js";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { LedgerWithContact } from "@/types";

export interface RectifyLedgerInput {
  total_amount: number;
  due_date: string;
  rectification_reason: string;
  invoice_number?: string | null;
}

function computeBalanceAfterRectification(
  previousTotal: number,
  previousBalanceDue: number,
  newTotal: number
): number {
  const paidAmount = Math.max(0, previousTotal - previousBalanceDue);
  return Math.max(0, newTotal - paidAmount);
}

function resolveStatusAfterRectification(
  balanceDue: number,
  dueDate: string,
  currentStatus: string
): string {
  if (balanceDue <= 0) {
    return "paid";
  }

  if (["cancelled", "refunded"].includes(currentStatus)) {
    return currentStatus;
  }

  const today = new Date().toISOString().slice(0, 10);

  if (dueDate < today) {
    return "overdue";
  }

  if (currentStatus === "paid") {
    return "pending";
  }

  return currentStatus === "overdue" ? "overdue" : "pending";
}

export async function rectifyLedger(
  supabase: SupabaseClient,
  userId: string,
  ledgerId: string,
  input: RectifyLedgerInput
): Promise<LedgerWithContact> {
  const existingLedger = await fetchLedgerById(supabase, userId, ledgerId);

  if (!existingLedger) {
    throw new Error("Ledger not found.");
  }

  if (existingLedger.status === "cancelled" || existingLedger.status === "refunded") {
    throw new Error("Cancelled or refunded ledgers cannot be rectified.");
  }

  if (existingLedger.balance_due <= 0 && existingLedger.status === "paid") {
    throw new Error("Paid ledgers cannot be rectified.");
  }

  const rectificationReason = input.rectification_reason.trim();

  if (rectificationReason.length < 3) {
    throw new Error("Rectification reason must be at least 3 characters.");
  }

  if (!Number.isFinite(input.total_amount) || input.total_amount <= 0) {
    throw new Error("Total amount must be a positive number.");
  }

  if (!input.due_date?.trim()) {
    throw new Error("Due date is required.");
  }

  const newBalanceDue = computeBalanceAfterRectification(
    existingLedger.total_amount,
    existingLedger.balance_due,
    input.total_amount
  );

  const nextVersion = existingLedger.current_version + 1;
  const nextStatus = resolveStatusAfterRectification(
    newBalanceDue,
    input.due_date,
    existingLedger.status
  );

  const { error: revisionError } = await supabase.from("ledger_revisions").insert({
    ledger_id: existingLedger.id,
    previous_total_amount: existingLedger.total_amount,
    previous_pdf_url: existingLedger.pdf_url,
    version_number: existingLedger.current_version,
    rectification_reason: rectificationReason,
  });

  if (revisionError) {
    throw new Error(revisionError.message || "Failed to snapshot ledger revision.");
  }

  const ledgerUpdate: Record<string, unknown> = {
    total_amount: input.total_amount,
    balance_due: newBalanceDue,
    due_date: input.due_date,
    current_version: nextVersion,
    status: nextStatus,
  };

  if (input.invoice_number !== undefined) {
    ledgerUpdate.invoice_number = input.invoice_number?.trim() || null;
  }

  const { error: updateError } = await supabase
    .from("ledgers")
    .update(ledgerUpdate)
    .eq("id", existingLedger.id)
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to update ledger.");
  }

  const updatedLedger = await fetchLedgerById(supabase, userId, ledgerId);

  if (!updatedLedger) {
    throw new Error("Ledger updated but refresh failed.");
  }

  return updatedLedger;
}
