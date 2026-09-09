"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/gst";
import { rectifyLedgerEntry } from "@/lib/ledgers";
import { LedgerWithContact } from "@/types";

interface RectifyLedgerModalProps {
  ledger: LedgerWithContact | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RectifyLedgerModal({
  ledger,
  isOpen,
  onClose,
  onSuccess,
}: RectifyLedgerModalProps) {
  const [totalAmount, setTotalAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [rectificationReason, setRectificationReason] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (ledger && isOpen) {
      setTotalAmount(String(ledger.total_amount));
      setDueDate(ledger.due_date);
      setInvoiceNumber(ledger.invoice_number ?? "");
      setRectificationReason("");
      setError("");
    }
  }, [ledger, isOpen]);

  function handleClose() {
    if (isSubmitting) {
      return;
    }

    setRectificationReason("");
    setError("");
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!ledger) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const parsedAmount = Number(totalAmount);

      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Enter a valid total amount.");
      }

      if (!rectificationReason.trim()) {
        throw new Error("Rectification reason is required.");
      }

      await rectifyLedgerEntry(ledger.id, {
        total_amount: parsedAmount,
        due_date: dueDate,
        rectification_reason: rectificationReason.trim(),
        invoice_number: invoiceNumber.trim() || null,
      });

      onSuccess();
      handleClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to rectify ledger."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!ledger) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Edit / Rectify Ledger">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-recoverpe-grey-medium">
          Rectifying {ledger.contact.name} saves a snapshot to revision history
          before applying changes. Current balance due:{" "}
          {formatCurrency(ledger.balance_due)} (v{ledger.current_version}).
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="rectify-total-amount"
              className="mb-1.5 block text-sm font-medium text-recoverpe-black"
            >
              Total amount (INR)
            </label>
            <Input
              id="rectify-total-amount"
              type="number"
              min="0"
              step="0.01"
              value={totalAmount}
              onChange={(event) => setTotalAmount(event.target.value)}
              required
            />
          </div>

          <div>
            <label
              htmlFor="rectify-due-date"
              className="mb-1.5 block text-sm font-medium text-recoverpe-black"
            >
              Due date
            </label>
            <Input
              id="rectify-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="rectify-invoice-number"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            Invoice number (optional)
          </label>
          <Input
            id="rectify-invoice-number"
            value={invoiceNumber}
            onChange={(event) => setInvoiceNumber(event.target.value)}
            placeholder="INV-001"
          />
        </div>

        <div>
          <label
            htmlFor="rectify-reason"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            Rectification reason
          </label>
          <textarea
            id="rectify-reason"
            value={rectificationReason}
            onChange={(event) => setRectificationReason(event.target.value)}
            rows={3}
            required
            placeholder="Explain what changed (e.g. corrected line item total)."
            className="w-full rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2 text-sm text-recoverpe-black outline-none focus:border-recoverpe-black"
          />
        </div>

        {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save rectification"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
