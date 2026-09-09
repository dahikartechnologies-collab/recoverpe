"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { logOfflinePayment } from "@/lib/transactions";
import { KioskVendorAssignment } from "@/types";

type KioskPaymentMode = "cash" | "cheque" | "upi";

const PAYMENT_MODE_OPTIONS: Array<{
  value: KioskPaymentMode;
  label: string;
  paymentMethod: "cash_manual" | "cheque" | "upi_link";
}> = [
  { value: "cash", label: "Cash", paymentMethod: "cash_manual" },
  { value: "cheque", label: "Cheque", paymentMethod: "cheque" },
  { value: "upi", label: "UPI", paymentMethod: "upi_link" },
];

interface CashCollectionDrawerProps {
  vendor: KioskVendorAssignment | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CashCollectionDrawer({
  vendor,
  isOpen,
  onClose,
  onSuccess,
}: CashCollectionDrawerProps) {
  const defaultLedgerId = vendor?.ledgers[0]?.id ?? "";
  const [ledgerId, setLedgerId] = useState(defaultLedgerId);
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<KioskPaymentMode>("cash");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const selectedLedger = useMemo(
    () => vendor?.ledgers.find((ledger) => ledger.id === ledgerId) ?? null,
    [vendor, ledgerId]
  );

  useEffect(() => {
    if (!isOpen || !vendor) {
      setIsVisible(false);
      return;
    }

    setLedgerId(vendor.ledgers[0]?.id ?? "");
    setAmount("");
    setPaymentMode("cash");
    setError("");
    setIsSubmitting(false);
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = "";
      setIsVisible(false);
    };
  }, [isOpen, vendor]);

  if (!isOpen || !vendor) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const parsedAmount = Number(amount);

    if (!ledgerId) {
      setError("Select an invoice to apply this collection.");
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid collection amount.");
      return;
    }

    if (selectedLedger && parsedAmount > selectedLedger.balance_due) {
      setError("Amount cannot exceed the invoice balance due.");
      return;
    }

    const paymentMethod = PAYMENT_MODE_OPTIONS.find(
      (option) => option.value === paymentMode
    )?.paymentMethod;

    if (!paymentMethod) {
      setError("Select a payment mode.");
      return;
    }

    setIsSubmitting(true);

    try {
      await logOfflinePayment({
        ledger_id: ledgerId,
        amount: parsedAmount,
        payment_method: paymentMethod,
      });
      onSuccess();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to log collection."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close collection drawer"
        className={`absolute inset-0 bg-recoverpe-black/50 transition-opacity duration-200 ease-out ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        disabled={isSubmitting}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kiosk-collection-title"
        className={`relative z-10 w-full max-w-lg rounded-t-2xl border border-recoverpe-grey-light bg-recoverpe-white px-4 pb-6 pt-5 shadow-none transition-all duration-200 ease-out ${
          isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-recoverpe-grey-light" />
        <div className="space-y-1">
          <p className="text-sm text-recoverpe-grey-medium">Log collection</p>
          <h2
            id="kiosk-collection-title"
            className="text-xl font-semibold text-recoverpe-black"
          >
            {vendor.contact_name}
          </h2>
          <p className="text-sm text-recoverpe-grey-medium">
            Outstanding: {formatCurrency(vendor.total_outstanding)}
          </p>
        </div>

        <form className="mt-6 space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          {vendor.ledgers.length > 1 ? (
            <div>
              <label
                htmlFor="kiosk-ledger"
                className="mb-2 block text-sm font-medium text-recoverpe-black"
              >
                Invoice
              </label>
              <select
                id="kiosk-ledger"
                value={ledgerId}
                onChange={(event) => setLedgerId(event.target.value)}
                className="w-full rounded-lg border border-recoverpe-grey-light bg-recoverpe-white px-4 py-4 text-base text-recoverpe-black"
              >
                {vendor.ledgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>
                    {(ledger.invoice_number || "Invoice").trim()} ·{" "}
                    {formatCurrency(ledger.balance_due)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div>
            <label
              htmlFor="kiosk-amount"
              className="mb-2 block text-sm font-medium text-recoverpe-black"
            >
              Amount collected
            </label>
            <input
              id="kiosk-amount"
              type="number"
              inputMode="decimal"
              min="1"
              step="1"
              placeholder="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-lg border border-recoverpe-grey-light px-4 py-4 text-2xl font-semibold tabular-nums text-recoverpe-black"
              required
            />
            {selectedLedger ? (
              <p className="mt-2 text-sm text-recoverpe-grey-medium">
                Balance due: {formatCurrency(selectedLedger.balance_due)}
              </p>
            ) : null}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-recoverpe-black">
              Payment mode
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_MODE_OPTIONS.map((option) => {
                const isActive = paymentMode === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPaymentMode(option.value)}
                    className={`rounded-lg border px-3 py-4 text-sm font-semibold ${
                      isActive
                        ? "border-recoverpe-black bg-recoverpe-black text-recoverpe-white"
                        : "border-recoverpe-grey-light bg-recoverpe-white text-recoverpe-black"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error ? (
            <p className="text-sm text-recoverpe-error">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-recoverpe-black px-4 py-4 text-base font-semibold text-recoverpe-white disabled:opacity-60"
          >
            {isSubmitting ? "Logging..." : "Log Collection"}
          </button>
        </form>
      </div>
    </div>
  );
}
