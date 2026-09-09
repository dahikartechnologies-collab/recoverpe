"use client";

import { FormEvent, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { PoweredByRecoverpeBadge } from "@/components/brand/PoweredByRecoverpeBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/gst";
import { generateKhataUpiIntent } from "@/lib/upi";
import { PublicKhataPaymentDetails, PublicOnboardResponse } from "@/types";

interface KhataQrPageClientProps {
  businessId: string;
  businessName: string;
}

type SubmitState = "idle" | "submitting" | "success" | "error";

export function KhataQrPageClient({
  businessId,
  businessName,
}: KhataQrPageClientProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [error, setError] = useState("");
  const [successAmount, setSuccessAmount] = useState(0);
  const [paymentDetails, setPaymentDetails] =
    useState<PublicKhataPaymentDetails | null>(null);
  const [autoApproved, setAutoApproved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitState("submitting");

    const parsedAmount = Number.parseFloat(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setSubmitState("error");
      setError("Please enter a valid amount.");
      return;
    }

    try {
      const response = await fetch("/api/public/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          name,
          phone,
          amount: parsedAmount,
        }),
      });

      const body = (await response.json()) as PublicOnboardResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error || "Failed to submit your details.");
      }

      setSuccessAmount(body.amount);
      setPaymentDetails(body.payment);
      setAutoApproved(body.auto_approved);
      setSubmitState("success");
    } catch (submitError) {
      setSubmitState("error");
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit your details."
      );
    }
  }

  if (submitState === "success") {
    const upiUri =
      paymentDetails?.virtual_upi_id && successAmount > 0
        ? generateKhataUpiIntent(
            paymentDetails.virtual_upi_id,
            paymentDetails.payee_name,
            successAmount
          )
        : null;

    return (
      <div className="flex min-h-screen flex-col">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
          <div className="rounded-lg border border-recoverpe-grey-light bg-recoverpe-white p-6 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
              Khata QR
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-recoverpe-black">
              {autoApproved ? "Khata opened" : "You're in the queue"}
            </h1>

            {upiUri ? (
              <div className="mt-6 space-y-4">
                <a
                  href={upiUri}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-recoverpe-black px-6 py-4 text-base font-semibold text-recoverpe-white transition hover:opacity-90"
                >
                  Pay via GPay / PhonePe / Paytm
                </a>
                <p className="text-sm font-medium text-recoverpe-black">
                  Tap to pay {formatCurrency(successAmount)} via any UPI app.
                </p>

                <div className="hidden md:block">
                  <p className="mb-3 text-xs uppercase tracking-wide text-recoverpe-grey-medium">
                    Desktop fallback
                  </p>
                  <div className="mx-auto inline-flex rounded-lg border border-recoverpe-grey-light p-4">
                    <QRCodeCanvas
                      value={upiUri}
                      size={220}
                      bgColor="#FFFFFF"
                      fgColor="#0A0A0A"
                      level="M"
                      includeMargin
                    />
                  </div>
                  <p className="mt-3 text-sm text-recoverpe-grey-medium">
                    Scan to pay {formatCurrency(successAmount)} if you are on another device.
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-recoverpe-grey-medium">
                {autoApproved
                  ? "Your digital khata entry has been created."
                  : `Please show this screen to the merchant at ${businessName}.`}
              </p>
            )}

            <div className="mt-6 rounded-md border border-recoverpe-black px-4 py-3 text-left">
              <p className="text-sm font-medium text-recoverpe-black">{name}</p>
              <p className="mt-1 text-sm tabular-nums text-recoverpe-grey-medium">
                {phone}
              </p>
              <p className="mt-2 text-sm font-semibold tabular-nums tracking-tight text-recoverpe-black">
                {formatCurrency(successAmount)}
              </p>
            </div>
          </div>
        </main>
        <PoweredByRecoverpeBadge sticky />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10 pb-24">
        <div className="rounded-lg border border-recoverpe-grey-light bg-recoverpe-white p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
            Khata QR
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-recoverpe-black">
            {businessName}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-recoverpe-grey-medium">
            Enter your details and amount for your digital receipt with{" "}
            <span className="font-medium text-recoverpe-black">{businessName}</span>.
          </p>

          <form className="mt-6 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-2">
              <label htmlFor="khata-name" className="text-sm font-medium text-recoverpe-black">
                Your name
              </label>
              <Input
                id="khata-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Rahul Sharma"
                autoComplete="name"
                required
                minLength={2}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="khata-phone" className="text-sm font-medium text-recoverpe-black">
                Phone number
              </label>
              <Input
                id="khata-phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="10-digit mobile number"
                autoComplete="tel"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="khata-amount" className="text-sm font-medium text-recoverpe-black">
                Amount (₹)
              </label>
              <Input
                id="khata-amount"
                type="number"
                inputMode="decimal"
                min="1"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="e.g. 1500"
                className="tabular-nums"
                required
              />
            </div>

            {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

            <Button
              type="submit"
              className="w-full"
              disabled={submitState === "submitting"}
            >
              {submitState === "submitting" ? "Submitting..." : "Continue"}
            </Button>
          </form>
        </div>
      </main>
      <PoweredByRecoverpeBadge sticky />
    </div>
  );
}
