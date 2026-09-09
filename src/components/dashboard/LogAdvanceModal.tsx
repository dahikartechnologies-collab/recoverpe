"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { logWalletAdvance } from "@/lib/wallet";

type AdvancePaymentMethod = "cash_manual" | "bank_transfer" | "cheque" | "upi_link";

interface LogAdvanceModalProps {
  contactId: string | null;
  contactName: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (walletBalance: number) => void;
}

export function LogAdvanceModal({
  contactId,
  contactName,
  isOpen,
  onClose,
  onSuccess,
}: LogAdvanceModalProps) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<AdvancePaymentMethod>("cash_manual");
  const [referenceId, setReferenceId] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setPaymentMethod("cash_manual");
      setReferenceId("");
      setError("");
    }
  }, [isOpen, contactId]);

  function handleClose() {
    if (isSubmitting) {
      return;
    }

    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!contactId) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const parsedAmount = Number(amount);

      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Enter a valid advance amount.");
      }

      const response = await logWalletAdvance({
        contact_id: contactId,
        amount: parsedAmount,
        payment_method: paymentMethod,
        reference_id: referenceId.trim() || null,
      });

      onSuccess(response.wallet_balance);
      handleClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to log advance payment."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Log Advance / Payment"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-recoverpe-grey-medium">
          Credit{" "}
          <span className="font-medium text-recoverpe-black">
            {contactName ?? "this vendor"}
          </span>
          &apos;s khata wallet without linking to a specific invoice.
        </p>

        <div>
          <label
            htmlFor="advanceAmount"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            Amount (INR)
          </label>
          <Input
            id="advanceAmount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        <div>
          <label
            htmlFor="advancePaymentMethod"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            Payment method
          </label>
          <select
            id="advancePaymentMethod"
            value={paymentMethod}
            onChange={(event) =>
              setPaymentMethod(event.target.value as AdvancePaymentMethod)
            }
            className="w-full rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2 text-sm text-recoverpe-black focus:border-recoverpe-black focus:outline-none"
          >
            <option value="cash_manual">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cheque">Cheque</option>
            <option value="upi_link">UPI</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="advanceReferenceId"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            Reference (optional)
          </label>
          <Input
            id="advanceReferenceId"
            value={referenceId}
            onChange={(event) => setReferenceId(event.target.value)}
            placeholder="UTR, cheque no., receipt note"
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
          <Button type="submit" disabled={isSubmitting || !contactId}>
            {isSubmitting ? "Saving..." : "Add to wallet"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
