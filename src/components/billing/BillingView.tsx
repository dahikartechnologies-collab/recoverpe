"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { WalletRechargePanel } from "@/components/billing/WalletRechargePanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Toast } from "@/components/ui/Toast";
import { getAuthHeaders } from "@/lib/auth-headers";
import { trackMetaEvent } from "@/lib/analytics-events";
import { parseApiJsonResponse } from "@/lib/parse-api-response";
import { startRazorpayCheckout } from "@/lib/razorpay-client";
import {
  FREE_PLAN_LEDGER_LIMIT,
  getPremiumAmountLabel,
  getPremiumOrderAmountPaise,
  PURCHASE_PRODUCTS,
  SubscriptionPurchaseType,
} from "@/lib/razorpay-products";
import { USD_TO_INR, VAPI_VOICE_MARGIN_RATE } from "@/lib/vapi-pricing";
import { useWorkspaceStore } from "@/store/workspace-store";
import { RecoverpeUser } from "@/types";

interface BillingViewProps {
  user: RecoverpeUser;
}

interface ToastState {
  message: string;
  variant: "success" | "error";
}

function getSubscriptionMetaParams(
  purchaseType: SubscriptionPurchaseType,
  eligibleForDiscount: boolean
) {
  const product = PURCHASE_PRODUCTS[purchaseType];
  const amountPaise =
    purchaseType === "subscription_premium"
      ? getPremiumOrderAmountPaise(eligibleForDiscount)
      : product.amountPaise;
  const value = amountPaise / 100;
  const predicted_ltv =
    product.planInterval === "annual" ? value : value * 12;

  return {
    currency: "INR" as const,
    value,
    predicted_ltv,
  };
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
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);
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
          trackMetaEvent(
            "Subscribe",
            getSubscriptionMetaParams(purchaseType, user.eligible_for_discount)
          );
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

  async function handleCancelSubscription() {
    setIsManagingSubscription(true);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/razorpay/subscription/cancel", {
        method: "POST",
        headers,
      });
      const payload = await parseApiJsonResponse<{ message?: string }>(response);

      bumpUserRefresh();
      setToast({
        message: payload.message ?? "Subscription cancelled.",
        variant: "success",
      });
    } catch (error) {
      setToast({
        message:
          error instanceof Error
            ? error.message
            : "Failed to cancel subscription.",
        variant: "error",
      });
    } finally {
      setIsManagingSubscription(false);
    }
  }

  const activeTier = activeBusiness?.subscription_tier ?? "starter";
  const normalizedActiveTier =
    activeTier === "free" ? "starter" : activeTier;
  const hasActivePaidSubscription =
    (normalizedActiveTier === "business" || normalizedActiveTier === "premium") &&
    activeBusiness?.subscription_status === "active";
  const isStarterTier = normalizedActiveTier === "starter";

  const tierCards: Array<{
    key: string;
    name: string;
    monthly?: SubscriptionPurchaseType;
    annual?: SubscriptionPurchaseType;
    monthlyPrice: string;
    annualPrice: string;
    features: string[];
    highlight?: boolean;
    isFree?: boolean;
  }> = [
    {
      key: "free",
      name: "Free",
      monthlyPrice: "₹0",
      annualPrice: "₹0",
      isFree: true,
      features: [
        `Core Khata with up to ${FREE_PLAN_LEDGER_LIMIT} invoices`,
        "Contact directory and vendor statements",
        "Manual ledger entry and CSV export",
        "Payment links for open invoices",
      ],
    },
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
      <PageHeader
        title="Billing"
        description="Choose a RecoverPe plan for your business workspace and recharge AI voice credits."
      />

      {hasActivePaidSubscription ? (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-recoverpe-black">
                AutoPay subscription active
              </p>
              <p className="mt-1 text-sm text-recoverpe-muted">
                {activeBusiness?.business_name ?? "Workspace"} is on the{" "}
                {normalizedActiveTier.charAt(0).toUpperCase() +
                  normalizedActiveTier.slice(1)}{" "}
                plan.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isManagingSubscription}
              onClick={() => void handleCancelSubscription()}
            >
              {isManagingSubscription ? "Cancelling…" : "Manage Subscription / Cancel"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tierCards.map((tier) => {
          const isCurrent = normalizedActiveTier === tier.key || (tier.key === "free" && normalizedActiveTier === "starter");

          return (
            <Card
              key={tier.key}
              className={tier.highlight || isCurrent ? "border-recoverpe-black" : ""}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <p className="type-eyebrow">
                    {tier.isFree
                      ? "Included today"
                      : tier.highlight
                        ? "Recommended"
                        : "Plan"}
                  </p>
                  {isCurrent ? <Badge tone="success">Current</Badge> : null}
                </div>
                <h2 className="mt-2 text-lg font-semibold tracking-tight text-recoverpe-black">
                  {tier.name}
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-3xl font-semibold tracking-tight tabular-nums text-recoverpe-black">
                    {tier.monthlyPrice}
                  </p>
                  <p className="mt-1 text-sm text-recoverpe-muted">
                    {tier.isFree
                      ? "No subscription required"
                      : `or ${tier.annualPrice} billed annually`}
                  </p>
                </div>
                <ul className="space-y-2 text-sm text-recoverpe-muted">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-recoverpe-success-ink"
                        aria-hidden
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="rounded-xl border border-recoverpe-success-line bg-recoverpe-success-fill px-3 py-2 text-sm text-recoverpe-success-ink">
                    Current plan on {activeBusiness?.business_name ?? "this workspace"}
                  </div>
                ) : tier.isFree ? (
                  <div className="rounded-xl border border-recoverpe-line bg-recoverpe-fill px-3 py-2 text-sm text-recoverpe-muted">
                    Upgrade anytime to unlock WhatsApp inbox, Smart Checkout, and AI recovery.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {isStarterTier && !tier.isFree ? (
                      <Button
                        type="button"
                        onClick={() =>
                          void handleSubscriptionPurchase(tier.monthly!)
                        }
                        disabled={processingPurchase === tier.monthly}
                      >
                        {processingPurchase === tier.monthly
                          ? "Processing…"
                          : "Subscribe via AutoPay"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() =>
                          void handleSubscriptionPurchase(tier.monthly!)
                        }
                        disabled={processingPurchase === tier.monthly}
                      >
                        {processingPurchase === tier.monthly
                          ? "Processing…"
                          : "Subscribe Monthly"}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleSubscriptionPurchase(tier.annual!)}
                      disabled={processingPurchase === tier.annual}
                    >
                      {processingPurchase === tier.annual
                        ? "Processing…"
                        : "Subscribe Annually"}
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
          <h2 className="text-lg font-semibold text-recoverpe-black">AI Voice Wallet</h2>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Calls bill dynamically from VAPI&apos;s actual USD cost × {USD_TO_INR} FX ×{" "}
            {(1 + VAPI_VOICE_MARGIN_RATE).toFixed(2)} margin. Recharges include 18% GST;
            only the base amount is credited.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <WalletRechargePanel
              currentBalanceInr={user.vapi_wallet_balance}
              prefill={{
                email: user.email,
                contact: user.phone_number,
              }}
              onSuccess={(baseAmountInr) => {
                bumpWalletRefresh();
                bumpUserRefresh();
                setToast({
                  message: `₹${baseAmountInr.toLocaleString("en-IN")} credited to your AI Voice Wallet.`,
                  variant: "success",
                });
              }}
            />
          </CardContent>
        </Card>
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
