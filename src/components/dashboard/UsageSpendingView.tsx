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
import { WalletRechargePanel } from "@/components/billing/WalletRechargePanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Toast } from "@/components/ui/Toast";
import { getAuthHeaders } from "@/lib/auth-headers";
import { UsageDashboardPayload } from "@/lib/business-usage-metering";
import { parseApiJsonResponse } from "@/lib/parse-api-response";
import {
  AI_VOICE_BILLING_TRANSPARENCY_COPY,
  PREMIUM_VAPI_TRIAL_MINUTES,
} from "@/lib/vapi-pricing";
import { useWorkspaceStore } from "@/store/workspace-store";

const METRIC_ICONS: Record<string, typeof Wallet> = {
  smart_collect: Wallet,
  sms: MessageCircle,
  whatsapp: Sparkles,
  invoices: FileText,
};

function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) {
    return "—";
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes <= 0) {
    return `${remainder}s`;
  }

  return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
        description={`Track Smart Collect settlements, omnichannel alerts, and AI voice wallet usage for ${activeBusiness?.business_name ?? "your business"}.`}
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
            <CardContent className="space-y-6 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                      {AI_VOICE_BILLING_TRANSPARENCY_COPY}
                      {payload.vapi_trial_minutes_remaining > 0
                        ? ` Premium includes a ${PREMIUM_VAPI_TRIAL_MINUTES}-minute trial; ${payload.vapi_trial_minutes_remaining} min remaining.`
                        : ` Premium ${PREMIUM_VAPI_TRIAL_MINUTES}-minute trial exhausted — wallet billing applies.`}
                    </p>
                  </div>
                </div>
                <Link href="/dashboard/billing">
                  <Button variant="secondary" size="sm">
                    Billing settings
                  </Button>
                </Link>
              </div>

              <WalletRechargePanel
                currentBalanceInr={payload.vapi_wallet_balance_inr}
                onSuccess={(baseAmountInr) => {
                  setToast(`₹${baseAmountInr.toLocaleString("en-IN")} credited to your AI Voice Wallet.`);
                  bumpWalletRefresh();
                  bumpUserRefresh();
                  void loadUsage();
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-sm font-medium text-recoverpe-black">
                  AI Voice Call History
                </p>
                <p className="mt-1 text-xs text-recoverpe-muted">
                  Each row shows the provider USD cost, buffered FX rate applied, and
                  final INR deducted for that call.
                </p>
              </div>

              {payload.vapi_call_history.length === 0 ? (
                <p className="text-sm text-recoverpe-muted">
                  No completed AI voice calls yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Debtor</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Base USD Cost</TableHead>
                      <TableHead>Applied FX Rate</TableHead>
                      <TableHead className="text-right">Final Billed INR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payload.vapi_call_history.map((call) => (
                      <TableRow key={call.id}>
                        <TableCell className="text-recoverpe-muted">
                          {formatDateTime(call.executed_at)}
                        </TableCell>
                        <TableCell className="font-medium text-recoverpe-black">
                          {call.debtor_name ?? "Unknown debtor"}
                        </TableCell>
                        <TableCell className="tabular-nums text-recoverpe-muted">
                          {formatDuration(call.duration_seconds)}
                        </TableCell>
                        <TableCell className="tabular-nums text-recoverpe-muted">
                          {call.vapi_cost_usd !== null
                            ? `$${call.vapi_cost_usd.toFixed(4)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="tabular-nums text-recoverpe-muted">
                          {call.applied_fx_rate !== null
                            ? `₹${call.applied_fx_rate.toFixed(2)}/USD`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums text-recoverpe-black">
                          {call.billed_amount_inr > 0
                            ? formatInr(call.billed_amount_inr)
                            : "₹0.00 (trial)"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
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
