"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { startRazorpayCheckout } from "@/lib/razorpay-client";
import {
  getPremiumAmountLabel,
  PURCHASE_PRODUCTS,
  SubscriptionPurchaseType,
} from "@/lib/razorpay-products";
import { useWorkspaceStore } from "@/store/workspace-store";
import { RecoverpeUser } from "@/types";

interface BillingViewProps {
  user: RecoverpeUser;
}

interface ToastState {
  message: string;
  variant: "success" | "error";
}

export function BillingView({ user }: BillingViewProps) {
  const bumpWalletRefresh = useWorkspaceStore((state) => state.bumpWalletRefresh);
  const bumpUserRefresh = useWorkspaceStore((state) => state.bumpUserRefresh);
  const setUserBillingState = useWorkspaceStore((state) => state.setUserBillingState);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const businesses = useWorkspaceStore((state) => state.businesses);
  const activeBusiness =
    businesses.find((business) => business.id === activeBusinessId) ?? null;
  const [processingPurchase, setProcessingPurchase] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  async function handleSubscriptionPurchase(
    purchaseType: SubscriptionPurchaseType
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
          setUserBillingState("premium", user.ledger_count);
          setToast({
            message: `${product.label} activated successfully.`,
            variant: "success",
          });
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Payment cancelled.") {
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

  async function handleWalletRecharge() {
    setProcessingPurchase("vapi_recharge_100");

    try {
      const product = PURCHASE_PRODUCTS.vapi_recharge_100;

      await startRazorpayCheckout({
        purchaseType: "vapi_recharge_100",
        description: product.label,
        prefill: {
          email: user.email,
          contact: user.phone_number,
        },
        onSuccess: () => {
          bumpWalletRefresh();
          bumpUserRefresh();
          const creditsAdded = PURCHASE_PRODUCTS.vapi_recharge_100.credits ?? 0;
          setToast({
            message: `${creditsAdded} AI credits added to your wallet.`,
            variant: "success",
          });
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Payment cancelled.") {
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

  const activeTier = activeBusiness?.subscription_tier ?? "free";

  const tierCards: Array<{
    key: string;
    name: string;
    monthly: SubscriptionPurchaseType;
    annual: SubscriptionPurchaseType;
    monthlyPrice: string;
    annualPrice: string;
    features: string[];
    highlight?: boolean;
  }> = [
    {
      key: "starter",
      name: "Starter",
      monthly: "subscription_starter_monthly",
      annual: "subscription_starter_annual",
      monthlyPrice: PURCHASE_PRODUCTS.subscription_starter_monthly.amountLabel,
      annualPrice: PURCHASE_PRODUCTS.subscription_starter_annual.amountLabel,
      features: [
        "Core Khata with unlimited invoices",
        "WhatsApp reminders",
        "Inbound AI debtor bot",
        "Live WhatsApp inbox",
      ],
    },
    {
      key: "business",
      name: "Business",
      monthly: "subscription_business_monthly",
      annual: "subscription_business_annual",
      monthlyPrice: PURCHASE_PRODUCTS.subscription_business_monthly.amountLabel,
      annualPrice: PURCHASE_PRODUCTS.subscription_business_annual.amountLabel,
      highlight: true,
      features: [
        "Everything in Starter",
        "Zero-MDR Smart Checkout",
        "Settlement Desk + Promise Register",
        "SMS payment receipts",
      ],
    },
    {
      key: "premium",
      name: "Premium",
      monthly: "subscription_premium",
      annual: "subscription_premium_annual",
      monthlyPrice: getPremiumAmountLabel(user.eligible_for_discount),
      annualPrice: PURCHASE_PRODUCTS.subscription_premium_annual.amountLabel,
      features: [
        "Everything in Business",
        "Morning AI briefing",
        "Debtor Health Score",
        "Field Agent + omnichannel escalation",
      ],
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-recoverpe-black">Billing</h1>
        <p className="mt-2 text-sm text-recoverpe-grey-medium">
          Choose a RecoverPe plan for your business workspace and recharge AI voice
          credits.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {tierCards.map((tier) => {
          const isCurrent = activeTier === tier.key;

          return (
            <Card
              key={tier.key}
              className={tier.highlight || isCurrent ? "border-recoverpe-black" : ""}
            >
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
                  {tier.highlight ? "Hero tier" : "Plan"}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-recoverpe-black">
                  {tier.name}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-3xl font-semibold text-recoverpe-black">
                    {tier.monthlyPrice}
                  </p>
                  <p className="mt-1 text-sm text-recoverpe-grey-medium">
                    or {tier.annualPrice} billed annually
                  </p>
                </div>
                <ul className="space-y-2 text-sm text-recoverpe-grey-medium">
                  {tier.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="rounded-md border border-recoverpe-grey-light px-3 py-2 text-sm text-recoverpe-success">
                    Current plan on {activeBusiness?.business_name ?? "this workspace"}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      onClick={() => void handleSubscriptionPurchase(tier.monthly)}
                      disabled={processingPurchase === tier.monthly}
                    >
                      {processingPurchase === tier.monthly
                        ? "Processing..."
                        : "Subscribe Monthly"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleSubscriptionPurchase(tier.annual)}
                      disabled={processingPurchase === tier.annual}
                    >
                      {processingPurchase === tier.annual
                        ? "Processing..."
                        : `Subscribe Annually`}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
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
                onClick={() => void handleWalletRecharge()}
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
                <li>Each AI call bills 3 credits per minute (rounded up).</li>
                <li>Credits are deducted when a call completes.</li>
                <li>Recharges apply instantly after successful payment.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-recoverpe-black">
            Legacy add-ons
          </h2>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Promise Register and Settlement Desk are now included in Business and
            Premium. Existing monthly add-on purchases still grandfather access until
            expiry.
          </p>
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
