"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/gst";
import { resolveSmartCheckout } from "@/lib/payments/smart-checkout-router";
import { generateUPIIntent, generateUPIQRCodeBase64 } from "@/lib/upi";
import { BusinessSubscriptionTier } from "@/types";

export interface SmartCheckoutRailsInput {
  amount: number;
  maxAmount: number;
  ledgerId: string;
  invoiceNumber: string | null;
  merchantName: string;
  businessTier: BusinessSubscriptionTier | null;
  merchantVpa: string | null;
  virtualBankAccountNumber: string | null;
  virtualIfscCode: string | null;
  showAmountEditor?: boolean;
}

async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function SmartCheckoutRails({
  amount: initialAmount,
  maxAmount,
  ledgerId,
  invoiceNumber,
  merchantName,
  businessTier,
  merchantVpa,
  virtualBankAccountNumber,
  virtualIfscCode,
  showAmountEditor = false,
}: SmartCheckoutRailsInput) {
  const [paymentAmount, setPaymentAmount] = useState(initialAmount);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    setPaymentAmount(initialAmount);
  }, [initialAmount]);

  const normalizedAmount = useMemo(() => {
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return maxAmount;
    }

    return Math.min(paymentAmount, maxAmount);
  }, [maxAmount, paymentAmount]);

  const checkout = useMemo(
    () =>
      resolveSmartCheckout({
        amount: normalizedAmount,
        ledgerId,
        invoiceNumber,
        business: businessTier ? { subscription_tier: businessTier } : null,
        businessName: merchantName,
        merchantVpa,
        virtualBankAccountNumber,
        virtualIfscCode,
      }),
    [
      businessTier,
      invoiceNumber,
      ledgerId,
      merchantName,
      merchantVpa,
      normalizedAmount,
      virtualBankAccountNumber,
      virtualIfscCode,
    ]
  );

  const isZeroMdrBank = checkout.mode === "zero_mdr_bank";

  const upiIntentUri = useMemo(() => {
    if (!checkout.upi) {
      return null;
    }

    return generateUPIIntent(
      checkout.upi.vpa,
      merchantName,
      normalizedAmount,
      checkout.paymentReference
    );
  }, [checkout.paymentReference, checkout.upi, merchantName, normalizedAmount]);

  useEffect(() => {
    if (!upiIntentUri || isZeroMdrBank) {
      setQrCodeDataUrl(null);
      return;
    }

    let cancelled = false;

    async function renderQrCode() {
      setQrError("");

      try {
        const dataUrl = await generateUPIQRCodeBase64(upiIntentUri!);

        if (!cancelled) {
          setQrCodeDataUrl(dataUrl);
        }
      } catch {
        if (!cancelled) {
          setQrCodeDataUrl(null);
          setQrError("Unable to render payment QR code.");
        }
      }
    }

    void renderQrCode();

    return () => {
      cancelled = true;
    };
  }, [isZeroMdrBank, upiIntentUri]);

  async function handleCopy(value: string, label: string) {
    await copyToClipboard(value);
    setCopyMessage(`${label} copied`);
    window.setTimeout(() => setCopyMessage(""), 2000);
  }

  return (
    <div className="space-y-4">
      {showAmountEditor ? (
        <div className="space-y-2">
          <label
            htmlFor="paymentAmount"
            className="block text-sm font-medium text-recoverpe-black"
          >
            Edit amount (partial payment)
          </label>
          <Input
            id="paymentAmount"
            type="number"
            inputMode="decimal"
            min={1}
            max={maxAmount}
            step="0.01"
            value={Number.isFinite(paymentAmount) ? paymentAmount : maxAmount}
            onChange={(event) => {
              const parsed = Number.parseFloat(event.target.value);
              setPaymentAmount(
                Number.isFinite(parsed) ? Math.min(parsed, maxAmount) : maxAmount
              );
            }}
          />
          <p className="text-xs text-recoverpe-muted">
            Outstanding balance: {formatCurrency(maxAmount)}
          </p>
        </div>
      ) : null}

      {isZeroMdrBank && checkout.bank ? (
        <div className="space-y-4 rounded-xl border border-recoverpe-line px-4 py-5">
          <div>
            <p className="text-sm font-semibold tracking-tight text-recoverpe-black">
              Pay via IMPS / NEFT / RTGS
            </p>
            <p className="mt-1 text-xs text-recoverpe-muted">
              Zero UPI MDR for payments above ₹2,000. Your khata updates
              automatically once the transfer is received.
            </p>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-recoverpe-muted">Beneficiary</p>
              <p className="font-medium">{checkout.bank.beneficiaryName}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-recoverpe-muted">Account number</p>
                <p className="font-mono text-sm tracking-wide">
                  {checkout.bank.accountNumber}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  void handleCopy(checkout.bank!.accountNumber, "Account number")
                }
              >
                Copy
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-recoverpe-muted">IFSC</p>
                <p className="font-mono text-sm tracking-wide">{checkout.bank.ifsc}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void handleCopy(checkout.bank!.ifsc, "IFSC")}
              >
                Copy
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-recoverpe-muted">Payment reference</p>
                <p className="font-mono text-sm tracking-wide">
                  {checkout.paymentReference}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  void handleCopy(checkout.paymentReference, "Payment reference")
                }
              >
                Copy
              </Button>
            </div>
          </div>
          {copyMessage ? (
            <p className="text-xs text-recoverpe-success-ink">{copyMessage}</p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="md:hidden">
            {upiIntentUri ? (
              <a href={upiIntentUri} className="block">
                <Button type="button" className="w-full">
                  Pay via UPI App
                </Button>
              </a>
            ) : null}
            <p className="mt-2 text-center text-xs text-recoverpe-muted">
              Opens Google Pay, PhonePe, Paytm, or your default UPI app.
            </p>
          </div>

          <div className="hidden md:block">
            <div className="flex flex-col items-center rounded-xl border border-recoverpe-line px-4 py-6">
              <p className="text-sm font-medium text-recoverpe-black">
                Scan to pay on mobile
              </p>
              <p className="mt-1 text-xs text-recoverpe-muted">
                Use any UPI app to scan this QR code.
              </p>
              {qrCodeDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrCodeDataUrl}
                  alt="UPI payment QR code"
                  className="mt-4 h-44 w-44 rounded-xl border border-recoverpe-line bg-recoverpe-white p-2"
                />
              ) : (
                <Skeleton className="mt-4 h-44 w-44 rounded-xl" />
              )}
              {qrError ? (
                <p className="mt-2 text-sm text-recoverpe-error">{qrError}</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-[11px] text-recoverpe-muted">
        {isZeroMdrBank
          ? "Bank transfers are reconciled automatically via RecoverPe Smart Collect."
          : "Payments go directly to the merchant UPI ID."}
      </p>
    </div>
  );
}
