"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/gst";
import { logOfflinePayment } from "@/lib/transactions";
import { LedgerWithContact } from "@/types";

type OfflinePaymentMethod = "cash_manual" | "bank_transfer";

interface LogOfflinePaymentModalProps {
  ledger: LedgerWithContact | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LogOfflinePaymentModal({
  ledger,
  isOpen,
  onClose,
  onSuccess,
}: LogOfflinePaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<OfflinePaymentMethod>("cash_manual");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (ledger && isOpen) {
      setAmount(String(ledger.balance_due));
      setPaymentMethod("cash_manual");
      setError("");
    }
  }, [ledger, isOpen]);

  function handleClose() {
    if (isSubmitting) {
      return;
    }

    setAmount("");
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
      const parsedAmount = Number(amount);

      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Enter a valid payment amount.");
      }

      await logOfflinePayment({
        ledger_id: ledger.id,
        amount: parsedAmount,
        payment_method: paymentMethod,
      });

      onSuccess();
      handleClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to log offline payment."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!ledger) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Log Offline Payment">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-md border border-recoverpe-grey-light bg-recoverpe-grey-light px-3 py-2 text-sm">
          <p className="font-medium text-recoverpe-black">{ledger.contact.name}</p>
          <p className="mt-1 text-recoverpe-grey-medium">
            Balance due: {formatCurrency(ledger.balance_due)}
          </p>
        </div>

        <div>
          <label
            htmlFor="paymentAmount"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            Amount received (INR)
          </label>
          <Input
            id="paymentAmount"
            type="number"
            min="0"
            step="0.01"
            max={ledger.balance_due}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </div>

        <div>
          <label
            htmlFor="paymentMethod"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            Payment method
          </label>
          <select
            id="paymentMethod"
            value={paymentMethod}
            onChange={(event) =>
              setPaymentMethod(event.target.value as OfflinePaymentMethod)
            }
            className="w-full min-h-11 rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2 text-sm text-recoverpe-black outline-none focus:border-recoverpe-black"
          >
            <option value="cash_manual">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
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
            {isSubmitting ? "Saving..." : "Log payment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
