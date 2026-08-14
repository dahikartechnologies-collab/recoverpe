"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { startRazorpayCheckout } from "@/lib/razorpay-client";
import {
  FREE_PLAN_LEDGER_LIMIT,
  PURCHASE_PRODUCTS,
} from "@/lib/razorpay-products";
import { useWorkspaceStore } from "@/store/workspace-store";
import { RecoverpeUser, SubscriptionPlan } from "@/types";

interface BillingViewProps {
  user: RecoverpeUser;
}

interface ToastState {
  message: string;
  variant: "success" | "error";
}

function planLabel(plan: SubscriptionPlan): string {
  return plan === "premium" ? "Premium" : "Free";
}

export function BillingView({ user }: BillingViewProps) {
  const bumpWalletRefresh = useWorkspaceStore((state) => state.bumpWalletRefresh);
  const bumpUserRefresh = useWorkspaceStore((state) => state.bumpUserRefresh);
  const setUserBillingState = useWorkspaceStore((state) => state.setUserBillingState);
  const [processingPurchase, setProcessingPurchase] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  async function handlePurchase(
    purchaseType: "subscription_premium" | "vapi_recharge_100"
  ) {
    setProcessingPurchase(purchaseType);

    try {
      const product = PURCHASE_PRODUCTS[purchaseType];

      await startRazorpayCheckout({
        purchaseType,
        description: product.label,
        prefill: {
          email: user.email,
          contact: user.phone_number,
        },
        onSuccess: () => {
          bumpWalletRefresh();
          bumpUserRefresh();

          if (purchaseType === "subscription_premium") {
            setUserBillingState("premium", user.ledger_count);
            setToast({
              message: "Premium activated successfully.",
              variant: "success",
            });
            return;
          }

          const creditsAdded = PURCHASE_PRODUCTS.vapi_recharge_100.credits ?? 0;
          setToast({
            message: `${creditsAdded} AI credits added to your wallet.`,
            variant: "success",
          });
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Payment cancelled."
      ) {
        return;
      }

      setToast({
        message:
          error instanceof Error ? error.message : "Payment could not be completed.",
        variant: "error",
      });
    } finally {
      setProcessingPurchase(null);
    }
  }

  const isPremium = user.subscription_plan === "premium";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-recoverpe-black">Billing</h1>
        <p className="mt-2 text-sm text-recoverpe-grey-medium">
          Manage your subscription and recharge AI voice credits for Sneha.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className={!isPremium ? "border-recoverpe-black" : ""}>
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
              Tier 1
            </p>
            <h2 className="mt-1 text-lg font-semibold text-recoverpe-black">Free</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-3xl font-semibold text-recoverpe-black">₹0</p>
            <ul className="space-y-2 text-sm text-recoverpe-grey-medium">
              <li>Up to {FREE_PLAN_LEDGER_LIMIT} invoices</li>
              <li>Manual WhatsApp reminders</li>
              <li>Personal and Business modes</li>
            </ul>
            <div className="rounded-md border border-recoverpe-grey-light px-3 py-2 text-sm">
              Current plan:{" "}
              <span className="font-medium text-recoverpe-black">
                {planLabel(user.subscription_plan)}
              </span>
            </div>
            {!isPremium ? (
              <p className="text-xs text-recoverpe-grey-medium">
                {user.ledger_count} of {FREE_PLAN_LEDGER_LIMIT} invoices used.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className={isPremium ? "border-recoverpe-black" : ""}>
          <CardHeader>
            <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
              Tier 2
            </p>
            <h2 className="mt-1 text-lg font-semibold text-recoverpe-black">Premium</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-3xl font-semibold text-recoverpe-black">
              {PURCHASE_PRODUCTS.subscription_premium.amountLabel}
            </p>
            <ul className="space-y-2 text-sm text-recoverpe-grey-medium">
              <li>Unlimited invoices</li>
              <li>Automated recovery cadences</li>
              <li>AI voice escalation with Sneha</li>
              <li>Priority business tooling</li>
            </ul>
            {isPremium ? (
              <div className="rounded-md border border-recoverpe-grey-light px-3 py-2 text-sm text-recoverpe-success">
                Your account is on Premium.
              </div>
            ) : (
              <Button
                type="button"
                onClick={() => void handlePurchase("subscription_premium")}
                disabled={processingPurchase === "subscription_premium"}
              >
                {processingPurchase === "subscription_premium"
                  ? "Processing..."
                  : "Upgrade"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-recoverpe-black">Recharge Wallet</h2>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Current balance:{" "}
            <span className="font-medium text-recoverpe-black">
              {Math.trunc(user.vapi_wallet_balance)} AI credits
            </span>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <p className="text-sm font-medium text-recoverpe-black">
                  {PURCHASE_PRODUCTS.vapi_recharge_100.label}
                </p>
                <p className="mt-1 text-sm text-recoverpe-grey-medium">
                  {PURCHASE_PRODUCTS.vapi_recharge_100.description}
                </p>
              </div>
              <p className="text-2xl font-semibold text-recoverpe-black">
                {PURCHASE_PRODUCTS.vapi_recharge_100.amountLabel}
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handlePurchase("vapi_recharge_100")}
                disabled={processingPurchase === "vapi_recharge_100"}
              >
                {processingPurchase === "vapi_recharge_100"
                  ? "Processing..."
                  : "Recharge"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <p className="text-sm font-medium text-recoverpe-black">How credits work</p>
              <ul className="space-y-2 text-sm text-recoverpe-grey-medium">
                <li>Each AI call costs 3 credits.</li>
                <li>Credits are deducted only when a call is initiated.</li>
                <li>Recharges apply instantly after successful payment.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {toast ? (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
