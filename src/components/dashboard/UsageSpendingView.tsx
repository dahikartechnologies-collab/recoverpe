"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  MessageCircle,
  Phone,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { getAuthHeaders } from "@/lib/auth-headers";
import { UsageDashboardPayload } from "@/lib/business-usage-metering";
import { parseApiJsonResponse } from "@/lib/parse-api-response";
import {
  PURCHASE_PRODUCTS,
  VapiWalletRechargePurchaseType,
} from "@/lib/razorpay-products";
import { startRazorpayCheckout } from "@/lib/razorpay-client";
import { useWorkspaceStore } from "@/store/workspace-store";

const METRIC_ICONS: Record<string, typeof Wallet> = {
  smart_collect: Wallet,
  sms: MessageCircle,
  whatsapp: Sparkles,
  invoices: FileText,
};

const WALLET_RECHARGE_PACKAGES: VapiWalletRechargePurchaseType[] = [
  "vapi_recharge_500",
  "vapi_recharge_1000",
  "vapi_recharge_5000",
];

function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatQuotaLabel(usage: number, quota: number, unlimited: boolean): string {
  if (unlimited) {
    return `${usage.toLocaleString("en-IN")} / Unlimited`;
  }

  return `${usage.toLocaleString("en-IN")} / ${quota.toLocaleString("en-IN")}`;
}

function usagePercent(usage: number, quota: number, unlimited: boolean): number {
  if (unlimited || quota <= 0) {
    return usage > 0 ? 100 : 0;
  }

  return Math.min(100, Math.round((usage / quota) * 100));
}

function CircularProgress({
  percent,
  comingSoon,
}: {
  percent: number;
  comingSoon?: boolean;
}) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const strokeClass = comingSoon
    ? "text-recoverpe-subtle"
    : percent >= 100
      ? "text-recoverpe-error"
      : percent >= 80
        ? "text-recoverpe-warning-ink"
        : "text-recoverpe-success";

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96" aria-hidden>
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-recoverpe-fill"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-[stroke-dashoffset] duration-150 ${strokeClass}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-semibold tabular-nums text-recoverpe-black">
          {comingSoon ? "Soon" : `${percent}%`}
        </span>
      </div>
    </div>
  );
}

export function UsageSpendingView() {
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const businesses = useWorkspaceStore((state) => state.businesses);
  const bumpWalletRefresh = useWorkspaceStore((state) => state.bumpWalletRefresh);
  const bumpUserRefresh = useWorkspaceStore((state) => state.bumpUserRefresh);
  const activeBusiness =
    businesses.find((business) => business.id === activeBusinessId) ?? null;
  const [payload, setPayload] = useState<UsageDashboardPayload | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [processingPurchase, setProcessingPurchase] =
    useState<VapiWalletRechargePurchaseType | null>(null);

  const loadUsage = useCallback(async () => {
    if (!activeBusinessId) {
      setPayload(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ business_id: activeBusinessId });
      const response = await fetch(`/api/dashboard/usage?${params.toString()}`, {
        headers,
      });
      const body = await parseApiJsonResponse<
        UsageDashboardPayload & { error?: string }
      >(response);

      if (!response.ok) {
        throw new Error(body.error || "Failed to load usage data.");
      }

      setPayload(body);
    } catch (loadError) {
      setPayload(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load usage data."
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeBusinessId]);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  async function handleWalletRecharge(purchaseType: VapiWalletRechargePurchaseType) {
    setProcessingPurchase(purchaseType);
    setToast("");

    try {
      const product = PURCHASE_PRODUCTS[purchaseType];

      await startRazorpayCheckout({
        purchaseType,
        description: product.description,
        onSuccess: () => {
          setToast(`${product.amountLabel} added to your AI Voice Wallet.`);
          bumpWalletRefresh();
          bumpUserRefresh();
          void loadUsage();
        },
      });
    } catch (checkoutError) {
      if (
        checkoutError instanceof Error &&
        checkoutError.message !== "Payment cancelled."
      ) {
        setToast(checkoutError.message);
      }
    } finally {
      setProcessingPurchase(null);
    }
  }

  if (!activeBusinessId) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-recoverpe-muted">
            Switch to a business workspace to view usage and spending.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Unit economics"
        title="Usage & Spending"
        description={`Track Smart Collect settlements, omnichannel alerts, and invoice quotas for ${activeBusiness?.business_name ?? "your business"} this billing period.`}
      />

      {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      ) : payload ? (
        <>
          <Card className="border-recoverpe-black">
            <CardContent className="space-y-5 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-recoverpe-line bg-recoverpe-fill text-recoverpe-black">
                    <Phone className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <p className="type-eyebrow">AI Voice Wallet</p>
                    <p className="type-stat mt-2">
                      {formatInr(payload.vapi_wallet_balance_inr)}
                    </p>
                    <p className="mt-1 text-xs text-recoverpe-muted">
                      Pay-as-you-go at {formatInr(payload.vapi_customer_rate_per_minute_inr)}
                      /min (30% margin over ₹20/min provider cost).
                      {payload.vapi_trial_minutes_remaining > 0
                        ? ` Premium trial remaining: ${payload.vapi_trial_minutes_remaining} min.`
                        : " Premium trial exhausted — wallet billing applies."}
                    </p>
                  </div>
                </div>
                <Link href="/dashboard/billing">
                  <Button variant="secondary" size="sm">
                    Billing settings
                  </Button>
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {WALLET_RECHARGE_PACKAGES.map((purchaseType) => {
                  const product = PURCHASE_PRODUCTS[purchaseType];

                  return (
                    <Button
                      key={purchaseType}
                      type="button"
                      variant="primary"
                      disabled={processingPurchase === purchaseType}
                      onClick={() => void handleWalletRecharge(purchaseType)}
                    >
                      {processingPurchase === purchaseType
                        ? "Processing…"
                        : `Recharge ${product.amountLabel}`}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="rounded-xl border border-recoverpe-success-line bg-recoverpe-success-fill p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-recoverpe-white text-recoverpe-success-ink">
                  <TrendingUp className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="type-eyebrow">MDR saved this period</p>
                  <p className="type-stat mt-2">
                    {formatInr(payload.mdr_tax_saved_inr)}
                  </p>
                  <p className="mt-1 text-xs text-recoverpe-muted">
                    0.4% vs UPI acquiring · {formatInr(payload.total_volume_collected_inr)}{" "}
                    collected · {formatInr(payload.total_gateway_fees_inr)} gateway fees
                  </p>
                </div>
              </div>
              <Link href="/dashboard/billing">
                <Button variant="secondary" size="sm">
                  Manage plan
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {payload.metrics.map((metric) => {
              const Icon = METRIC_ICONS[metric.key] ?? Wallet;
              const percent = usagePercent(
                metric.usage,
                metric.quota,
                metric.unlimited
              );

              return (
                <Card key={metric.key}>
                  <CardContent className="flex items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon
                          className="h-4 w-4 text-recoverpe-muted"
                          aria-hidden
                        />
                        <p className="text-sm font-medium text-recoverpe-black">
                          {metric.label}
                        </p>
                      </div>
                      <p className="mt-3 text-lg font-semibold tabular-nums tracking-tight text-recoverpe-black">
                        {formatQuotaLabel(
                          metric.usage,
                          metric.quota,
                          metric.unlimited
                        )}
                      </p>
                      <p className="mt-2 text-xs text-recoverpe-muted">
                        {metric.comingSoon
                          ? `Coming soon · ${metric.overageLabel}`
                          : metric.overageLabel
                            ? `Overage: ${metric.overageLabel}`
                            : "Included in your plan"}
                      </p>
                    </div>
                    <CircularProgress
                      percent={percent}
                      comingSoon={metric.comingSoon}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {payload.pass_through_overages ? (
            <p className="text-xs text-recoverpe-muted">
              Pass-through overages are enabled. Usage beyond included quotas will
              appear on your next RecoverPe invoice.
            </p>
          ) : null}
        </>
      ) : null}

      {toast ? (
        <Toast message={toast} variant="success" onClose={() => setToast("")} />
      ) : null}
    </div>
  );
}
