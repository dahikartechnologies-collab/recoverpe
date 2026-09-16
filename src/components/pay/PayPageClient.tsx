"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  trackPayPageViewed,
  trackPaymentClaimed,
} from "@/lib/analytics-events";
import { formatCurrency } from "@/lib/gst";
import { resolveSmartCheckout } from "@/lib/payments/smart-checkout-router";
import { generateUPIIntent, generateUPIQRCodeBase64 } from "@/lib/upi";
import { PublicPayLedgerData } from "@/types";

interface PayPageClientProps {
  data: PublicPayLedgerData;
}

interface PaymentProofUploadProps {
  ledgerId: string;
  balanceDue: number;
}

function PaymentProofUpload({ ledgerId, balanceDue }: PaymentProofUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [claimedAmount, setClaimedAmount] = useState(balanceDue);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!file) {
      setError("Select a payment screenshot to upload.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("screenshot", file);
      formData.append("claimed_amount", String(claimedAmount));

      const response = await fetch(`/api/pay/${ledgerId}/verify`, {
        method: "POST",
        body: formData,
      });

      const body = (await response.json()) as { message?: string; error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Failed to submit payment proof.");
      }

      setMessage(body.message ?? "Payment proof submitted for verification.");
      setFile(null);
      trackPaymentClaimed({ amountInr: claimedAmount });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit payment proof."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
      <Input
        type="number"
        min={1}
        max={balanceDue}
        step="0.01"
        value={claimedAmount}
        onChange={(event) =>
          setClaimedAmount(Number.parseFloat(event.target.value) || balanceDue)
        }
      />
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="block w-full text-sm text-recoverpe-grey-medium file:mr-3 file:rounded-md file:border file:border-recoverpe-grey-light file:bg-recoverpe-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-recoverpe-black"
      />
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : "Submit for Verification"}
      </Button>
      {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}
      {message ? <p className="text-sm text-recoverpe-success">{message}</p> : null}
    </form>
  );
}

function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function clampPaymentAmount(value: number, maxAmount: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return maxAmount;
  }

  return Math.min(value, maxAmount);
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

export function PayPageClient({ data }: PayPageClientProps) {
  const [paymentAmount, setPaymentAmount] = useState(data.balance_due);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const merchantName = data.business_name ?? "Recoverpe Merchant";

  useEffect(() => {
    trackPayPageViewed({ amountDueInr: data.balance_due });
  }, [data.balance_due]);

  const normalizedAmount = useMemo(
    () => clampPaymentAmount(paymentAmount, data.balance_due),
    [paymentAmount, data.balance_due]
  );

  const checkout = useMemo(
    () =>
      resolveSmartCheckout({
        amount: normalizedAmount,
        ledgerId: data.ledger_id,
        invoiceNumber: data.invoice_number,
        business: data.business_tier
          ? { subscription_tier: data.business_tier }
          : null,
        businessName: data.business_name,
        merchantVpa: data.merchant_vpa,
        virtualBankAccountNumber: data.virtual_bank_account_number,
        virtualIfscCode: data.virtual_ifsc_code,
      }),
    [
      data.business_name,
      data.business_tier,
      data.invoice_number,
      data.ledger_id,
      data.merchant_vpa,
      data.virtual_bank_account_number,
      data.virtual_ifsc_code,
      normalizedAmount,
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

  function handleAmountChange(rawValue: string) {
    const parsed = Number.parseFloat(rawValue);

    if (!Number.isFinite(parsed)) {
      setPaymentAmount(data.balance_due);
      return;
    }

    setPaymentAmount(clampPaymentAmount(parsed, data.balance_due));
  }

  async function handleCopy(value: string, label: string) {
    await copyToClipboard(value);
    setCopyMessage(`${label} copied`);
    window.setTimeout(() => setCopyMessage(""), 2000);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-8">
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2 text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-recoverpe-grey-medium">
              Recoverpe Secure Payment
            </p>
            <h1 className="text-2xl font-semibold text-recoverpe-black">
              Pay {formatCurrency(normalizedAmount)}
            </h1>
            <p className="text-sm text-recoverpe-grey-medium">
              For {data.contact_name}
              {data.business_name ? ` · ${data.business_name}` : ""}
            </p>
            {data.invoice_number ? (
              <p className="text-sm text-recoverpe-grey-medium">
                Invoice {data.invoice_number} · Due {formatDueDate(data.due_date)}
              </p>
            ) : (
              <p className="text-sm text-recoverpe-grey-medium">
                Due {formatDueDate(data.due_date)}
              </p>
            )}
          </div>

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
              max={data.balance_due}
              step="0.01"
              value={Number.isFinite(paymentAmount) ? paymentAmount : data.balance_due}
              onChange={(event) => handleAmountChange(event.target.value)}
            />
            <p className="text-xs text-recoverpe-grey-medium">
              Outstanding balance: {formatCurrency(data.balance_due)}
            </p>
          </div>

          {isZeroMdrBank && checkout.bank ? (
            <div className="space-y-4 rounded-md border border-recoverpe-grey-light px-4 py-5">
              <div>
                <p className="text-sm font-semibold text-recoverpe-black">
                  Pay via IMPS / NEFT / RTGS
                </p>
                <p className="mt-1 text-xs text-recoverpe-grey-medium">
                  Zero UPI MDR for payments above ₹2,000. Your invoice updates
                  automatically once the transfer is received.
                </p>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-recoverpe-grey-medium">Beneficiary</p>
                    <p className="font-medium">{checkout.bank.beneficiaryName}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-recoverpe-grey-medium">Account number</p>
                    <p className="font-mono">{checkout.bank.accountNumber}</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      void handleCopy(checkout.bank!.accountNumber, "Account number")
                    }
                  >
                    Copy
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-recoverpe-grey-medium">IFSC</p>
                    <p className="font-mono">{checkout.bank.ifsc}</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void handleCopy(checkout.bank!.ifsc, "IFSC")}
                  >
                    Copy
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-recoverpe-grey-medium">Payment reference</p>
                    <p className="font-mono">{checkout.paymentReference}</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      void handleCopy(
                        checkout.paymentReference,
                        "Payment reference"
                      )
                    }
                  >
                    Copy
                  </Button>
                </div>
              </div>
              {copyMessage ? (
                <p className="text-xs text-recoverpe-success">{copyMessage}</p>
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
                <p className="mt-2 text-center text-xs text-recoverpe-grey-medium">
                  Opens Google Pay, PhonePe, Paytm, or your default UPI app.
                </p>
              </div>

              <div className="hidden md:block">
                <div className="flex flex-col items-center rounded-md border border-recoverpe-grey-light px-4 py-6">
                  <p className="text-sm font-medium text-recoverpe-black">
                    Scan to pay on mobile
                  </p>
                  <p className="mt-1 text-xs text-recoverpe-grey-medium">
                    Use any UPI app to scan this QR code.
                  </p>
                  {qrCodeDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrCodeDataUrl}
                      alt="UPI payment QR code"
                      className="mt-4 h-44 w-44 rounded-md border border-recoverpe-grey-light bg-recoverpe-white p-2"
                    />
                  ) : (
                    <p className="mt-4 text-sm text-recoverpe-grey-medium">
                      {qrError || "Generating QR code..."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-recoverpe-grey-light pt-4 space-y-3">
            <p className="text-sm font-medium text-recoverpe-black">
              {isZeroMdrBank
                ? "Paid but invoice not updated yet?"
                : "Already paid? Upload payment screenshot"}
            </p>
            <PaymentProofUpload ledgerId={data.ledger_id} balanceDue={data.balance_due} />
          </div>

          {data.pdf_url ? (
            <div className="border-t border-recoverpe-grey-light pt-4 text-center">
              <a
                href={data.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-recoverpe-black underline underline-offset-2"
              >
                View invoice PDF
              </a>
            </div>
          ) : null}

          <p className="text-center text-[11px] text-recoverpe-grey-medium">
            {isZeroMdrBank
              ? "Bank transfers are reconciled automatically via RecoverPe Smart Collect."
              : "Payments go directly to the merchant UPI ID."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
