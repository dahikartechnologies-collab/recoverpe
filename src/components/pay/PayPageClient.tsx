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

export function PayPageClient({ data }: PayPageClientProps) {
  const [paymentAmount, setPaymentAmount] = useState(data.balance_due);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState("");

  const merchantName = data.business_name ?? "Recoverpe Merchant";
  const transactionReference = data.invoice_number ?? data.ledger_id;

  // Top of the debtor funnel. Fires once per mount; the ledger id is
  // deliberately not sent to third parties.
  useEffect(() => {
    trackPayPageViewed({ amountDueInr: data.balance_due });
  }, [data.balance_due]);

  const normalizedAmount = useMemo(
    () => clampPaymentAmount(paymentAmount, data.balance_due),
    [paymentAmount, data.balance_due]
  );

  const upiIntentUri = useMemo(
    () =>
      generateUPIIntent(
        data.merchant_vpa,
        merchantName,
        normalizedAmount,
        transactionReference
      ),
    [data.merchant_vpa, merchantName, normalizedAmount, transactionReference]
  );

  useEffect(() => {
    let cancelled = false;

    async function renderQrCode() {
      setQrError("");

      try {
        const dataUrl = await generateUPIQRCodeBase64(upiIntentUri);

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
  }, [upiIntentUri]);

  function handleAmountChange(rawValue: string) {
    const parsed = Number.parseFloat(rawValue);

    if (!Number.isFinite(parsed)) {
      setPaymentAmount(data.balance_due);
      return;
    }

    setPaymentAmount(clampPaymentAmount(parsed, data.balance_due));
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

          <div className="space-y-4">
            <div className="md:hidden">
              <a href={upiIntentUri} className="block">
                <Button type="button" className="w-full">
                  Pay via UPI App
                </Button>
              </a>
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

          <div className="border-t border-recoverpe-grey-light pt-4 space-y-3">
            <p className="text-sm font-medium text-recoverpe-black">
              Already paid? Upload payment screenshot
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
            Payments go directly to the merchant UPI ID. Recoverpe does not hold
            your funds.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
