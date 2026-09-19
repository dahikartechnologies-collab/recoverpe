"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { getAuthHeaders } from "@/lib/auth-headers";
import {
  devFulfillRazorpayOrder,
  fulfillRazorpayOrderAfterCheckout,
} from "@/lib/razorpay-client";
import { parseApiJsonResponse } from "@/lib/parse-api-response";
import { useWorkspaceStore } from "@/store/workspace-store";

interface SecureBankLinkingProps {
  onVerified?: () => void;
}

export function SecureBankLinking({ onVerified }: SecureBankLinkingProps) {
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleVerifyPayment() {
    if (!activeBusinessId) {
      setError("Select a business workspace before verifying your bank account.");
      return;
    }

    setIsProcessing(true);
    setError("");
    setMessage("");

    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/kyc/merchant/init-verify", {
        method: "POST",
        headers,
        body: JSON.stringify({ business_id: activeBusinessId }),
      });

      const payload = await parseApiJsonResponse<{
        simulated?: boolean;
        order: { id: string; amount: number; currency: string };
        key?: string | null;
      }>(response);

      if (payload.simulated) {
        await devFulfillRazorpayOrder({ order_id: payload.order.id });
        await fulfillRazorpayOrderAfterCheckout(payload.order.id);
        setMessage("Bank account verified and locked for settlements.");
        onVerified?.();
        return;
      }

      if (!payload.key) {
        throw new Error("Razorpay public key is not configured.");
      }

      const razorpayKey = payload.key;

      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => {
          if (!window.Razorpay) {
            reject(new Error("Razorpay checkout is unavailable."));
            return;
          }

          const checkout = new window.Razorpay({
            key: razorpayKey,
            amount: payload.order.amount,
            currency: payload.order.currency,
            name: "RecoverPe",
            description: "Secure Bank Linking — ₹5 verification fee",
            order_id: payload.order.id,
            theme: { color: "#0A0A0A" },
            handler: async () => {
              try {
                await fulfillRazorpayOrderAfterCheckout(payload.order.id);
                setMessage(
                  "Payment received. Your settlement account is verified and locked."
                );
                onVerified?.();
                resolve();
              } catch (fulfillError) {
                reject(
                  fulfillError instanceof Error
                    ? fulfillError
                    : new Error("Failed to finalize bank verification.")
                );
              }
            },
            modal: {
              ondismiss: () => reject(new Error("Payment cancelled.")),
            },
          });

          checkout.on("payment.failed", () => {
            reject(new Error("Payment failed. Please try again."));
          });

          checkout.open();
        };
        script.onerror = () =>
          reject(new Error("Failed to load Razorpay checkout script."));
        document.body.appendChild(script);
      });
    } catch (checkoutError) {
      if (
        checkoutError instanceof Error &&
        checkoutError.message === "Payment cancelled."
      ) {
        return;
      }

      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Failed to start bank verification checkout."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <Card className="border-recoverpe-success-line">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-recoverpe-success-ink" aria-hidden />
          <h2 className="type-section-title">Instant Secure Bank Linking</h2>
          <Badge tone="success">RBI-compliant</Badge>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-recoverpe-muted">
          To comply with RBI guidelines and ensure your settlements are routed
          securely, a one-time verification fee of{" "}
          <span className="font-semibold tabular-nums text-recoverpe-black">₹5</span>{" "}
          applies. We will automatically capture and verify the account you pay
          from — UPI or bank — and permanently lock Smart Collect settlements to
          that source.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-recoverpe-line bg-recoverpe-canvas px-4 py-3 text-sm text-recoverpe-muted">
          Pay from the exact bank account or UPI ID you want RecoverPe to settle
          into. Manual account entry is disabled after verification.
        </div>
        <Button
          type="button"
          onClick={() => void handleVerifyPayment()}
          disabled={isProcessing || !activeBusinessId}
        >
          {isProcessing ? "Opening checkout…" : "Pay ₹5 to Verify Account"}
        </Button>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
      </CardContent>
    </Card>
  );
}
