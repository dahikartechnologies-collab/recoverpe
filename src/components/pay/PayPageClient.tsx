"use client";

import { useEffect, useState, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PaymentSuccessCelebration } from "@/components/pay/PaymentSuccessCelebration";
import { SmartCheckoutRails } from "@/components/pay/SmartCheckoutRails";
import { usePaymentStatusPolling } from "@/hooks/use-payment-status-polling";
import {
  trackPayPageViewed,
  trackPaymentClaimed,
} from "@/lib/analytics-events";
import { formatCurrency } from "@/lib/gst";
import { isZeroMdrCheckoutEligible } from "@/lib/entitlements";
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

export function PayPageClient({ data }: PayPageClientProps) {
  const [isPaid, setIsPaid] = useState(false);
  const autoReconcileEligible = isZeroMdrCheckoutEligible(
    data.business_tier ? { subscription_tier: data.business_tier } : null
  );

  useEffect(() => {
    trackPayPageViewed({ amountDueInr: data.balance_due });
  }, [data.balance_due]);

  usePaymentStatusPolling({
    statusUrl: `/api/pay/${data.ledger_id}/status`,
    enabled: !isPaid && data.balance_due > 0,
    onPaid: () => setIsPaid(true),
  });

  if (isPaid) {
    return (
      <PaymentSuccessCelebration
        amount={data.balance_due}
        subtitle="Your invoice has been marked paid automatically."
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center bg-recoverpe-canvas px-4 py-8">
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2 text-center">
            <p className="type-eyebrow">
              Recoverpe Secure Payment
            </p>
            <h1 className="text-4xl font-semibold tracking-tight tabular-nums text-recoverpe-black">
              {formatCurrency(data.balance_due)}
            </h1>
            <p className="text-sm text-recoverpe-muted">
              Pay for {data.contact_name}
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

          <SmartCheckoutRails
            amount={data.balance_due}
            maxAmount={data.balance_due}
            ledgerId={data.ledger_id}
            invoiceNumber={data.invoice_number}
            merchantName={data.business_name ?? "Recoverpe Merchant"}
            businessTier={data.business_tier}
            merchantVpa={data.merchant_vpa}
            virtualBankAccountNumber={data.virtual_bank_account_number}
            virtualIfscCode={data.virtual_ifsc_code}
            showAmountEditor
          />

          {!autoReconcileEligible ? (
            <div className="border-t border-recoverpe-line pt-4 space-y-3">
              <p className="text-sm font-medium text-recoverpe-black">
                Already paid? Upload payment screenshot
              </p>
              <PaymentProofUpload
                ledgerId={data.ledger_id}
                balanceDue={data.balance_due}
              />
            </div>
          ) : (
            <p className="border-t border-recoverpe-line pt-4 text-center text-xs text-recoverpe-muted">
              Waiting for your bank transfer? This page will update automatically once
              payment is received.
            </p>
          )}

          {data.pdf_url ? (
            <div className="border-t border-recoverpe-line pt-4 text-center">
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
        </CardContent>
      </Card>
    </div>
  );
}
