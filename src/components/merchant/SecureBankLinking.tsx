"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { getAuthHeaders } from "@/lib/auth-headers";
import type { MerchantBankAccountType } from "@/lib/payments/merchant-bank-account-type";
import {
  devFulfillRazorpayOrder,
  fulfillRazorpayOrderAfterCheckout,
} from "@/lib/razorpay-client";
import { parseApiJsonResponse } from "@/lib/parse-api-response";
import { trackMetaEvent } from "@/lib/analytics-events";
import { useWorkspaceStore } from "@/store/workspace-store";

interface SecureBankLinkingProps {
  onVerified?: () => void;
  hasVerifiedAccounts?: boolean;
}

function readAccountType(value: string): MerchantBankAccountType {
  return value === "personal" ? "personal" : "business";
}

export function SecureBankLinking({
  onVerified,
  hasVerifiedAccounts = false,
}: SecureBankLinkingProps) {
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accountType, setAccountType] =
    useState<MerchantBankAccountType>("business");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleVerifyPayment(selectedType: MerchantBankAccountType) {
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
        body: JSON.stringify({
          business_id: activeBusinessId,
          account_type: selectedType,
        }),
      });

      const payload = await parseApiJsonResponse<{
        simulated?: boolean;
        order: { id: string; amount: number; currency: string };
        key?: string | null;
      }>(response);

      if (payload.simulated) {
        await devFulfillRazorpayOrder({ order_id: payload.order.id });
        await fulfillRazorpayOrderAfterCheckout(payload.order.id);
        trackMetaEvent("AddPaymentInfo", { currency: "INR", value: 5.0 });
        setMessage("Bank account verified and locked for settlements.");
        setIsModalOpen(false);
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
                trackMetaEvent("AddPaymentInfo", { currency: "INR", value: 5.0 });
                setMessage(
                  "Payment received. Your settlement account is verified and locked."
                );
                setIsModalOpen(false);
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
          securely, a verification fee of{" "}
          <span className="font-semibold tabular-nums text-recoverpe-black">₹5</span>{" "}
          applies for each bank account you add. We capture the account you pay
          from — UPI or bank — and can lock Smart Collect to your primary source.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-recoverpe-line bg-recoverpe-canvas px-4 py-3 text-sm text-recoverpe-muted">
          Pay from the exact bank account or UPI ID you want RecoverPe to settle
          into. You can verify both a business/current account and a
          personal/savings account.
        </div>
        <Button
          type="button"
          onClick={() => {
            setError("");
            setIsModalOpen(true);
          }}
          disabled={isProcessing || !activeBusinessId}
        >
          {hasVerifiedAccounts
            ? "Add Another Bank Account (₹5 Verification)"
            : "Pay ₹5 to Verify Account"}
        </Button>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {message ? <Alert tone="success">{message}</Alert> : null}
      </CardContent>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (!isProcessing) {
            setIsModalOpen(false);
          }
        }}
        title="Choose account type"
        disableClose={isProcessing}
      >
        <div className="space-y-4">
          <p className="text-sm text-recoverpe-muted">
            Select whether this ₹5 payment is from a business current account or a
            personal savings account. Pay from that exact source.
          </p>
          <label className="block text-sm">
            <span className="font-medium text-recoverpe-black">Account type</span>
            <Select
              className="mt-1"
              value={accountType}
              onChange={(event) =>
                setAccountType(readAccountType(event.target.value))
              }
              disabled={isProcessing}
            >
              <option value="business">Business / Current</option>
              <option value="personal">Personal / Savings</option>
            </Select>
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isProcessing}
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isProcessing || !activeBusinessId}
              onClick={() => void handleVerifyPayment(accountType)}
            >
              {isProcessing ? "Opening checkout…" : "Continue to ₹5 payment"}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
