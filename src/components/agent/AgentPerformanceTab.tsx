"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import type { AgentMeResponse } from "@/lib/agent-client";
import { withdrawAgentFunds } from "@/lib/agent-client";
import { payoutKindLabel } from "@/lib/agent/discounts";
import { AGENT_TIERS, resolveAgentTier } from "@/lib/agent/tiers";
import { Download, Wallet } from "lucide-react";

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function tierBadgeTone(tierId: string): "neutral" | "warning" | "success" {
  switch (tierId) {
    case "gold":
      return "success";
    case "silver":
      return "warning";
    default:
      return "neutral";
  }
}

function downloadTdsInvoice(payout: {
  id: string;
  amount_inr: number;
  kind: string;
  period_ym: string | null;
  utr_number: string | null;
  settled_at: string | null;
}): void {
  const lines = [
    "RecoverPe Agent Commission Tax Invoice",
    "--------------------------------------",
    `Payout ID: ${payout.id}`,
    `Type: ${payoutKindLabel(payout.kind)}`,
    `Period: ${payout.period_ym ?? "—"}`,
    `Amount (INR): ${payout.amount_inr}`,
    `UTR: ${payout.utr_number ?? "Pending"}`,
    `Settled: ${payout.settled_at ? formatDateTime(payout.settled_at) : "—"}`,
    "",
    "TDS deducted as per Section 194H where applicable.",
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `recoverpe-agent-invoice-${payout.id.slice(0, 8)}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

interface AgentPerformanceTabProps {
  payload: AgentMeResponse;
  onWithdrawComplete?: () => void;
}

export function AgentPerformanceTab({
  payload,
  onWithdrawComplete,
}: AgentPerformanceTabProps) {
  const { analytics } = payload;
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawMessage, setWithdrawMessage] = useState("");

  if (!analytics?.financials || !analytics.discount_stats) {
    return (
      <Card>
        <EmptyState
          icon={<Wallet className="h-5 w-5" aria-hidden />}
          title="Performance data unavailable"
          description="We could not load your commission analytics. Refresh the page or try again in a moment."
        />
      </Card>
    );
  }

  const { financials, discount_stats, payout_history = [] } = analytics;
  const tier = resolveAgentTier(analytics.sales_closed);
  const quotaUsedPercent = Math.min(
    100,
    (discount_stats.quota_used_bps / Math.max(discount_stats.monthly_cap_bps, 1)) *
      100
  );

  async function handleWithdraw() {
    setWithdrawError("");
    setWithdrawMessage("");
    setIsWithdrawing(true);

    try {
      const result = await withdrawAgentFunds();
      setWithdrawMessage(
        `${formatInr(result.total_inr)} sent to your bank · UTR ${result.utr_number}`
      );
      onWithdrawComplete?.();
    } catch (error) {
      setWithdrawError(
        error instanceof Error ? error.message : "Failed to withdraw commissions."
      );
    } finally {
      setIsWithdrawing(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="type-section-title">Commission wallet</h2>
            <p className="mt-1 text-sm text-recoverpe-muted">
              Treasury balances for withdrawals, clearing, and lifetime earnings.
            </p>
          </div>
          <Badge tone={tierBadgeTone(tier.id)}>
            {tier.label} Agent · {tier.commissionRateLabel} tier rate
          </Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-1 divide-y divide-recoverpe-line p-0 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <div className="p-6">
            <p className="type-eyebrow">Available to withdraw</p>
            <p className="type-stat mt-3">
              {formatInr(financials.available_to_withdraw_inr)}
            </p>
            <p className="mt-2 text-xs text-recoverpe-success-ink">
              Approved commissions ready for payout
            </p>
            {financials.available_to_withdraw_inr > 0 ? (
              <Button
                type="button"
                size="sm"
                className="mt-4"
                disabled={isWithdrawing}
                onClick={() => void handleWithdraw()}
              >
                {isWithdrawing ? "Processing…" : "Withdraw Funds"}
              </Button>
            ) : null}
          </div>
          <div className="p-6">
            <p className="type-eyebrow">In-clearing / escrow</p>
            <p className="type-stat mt-3">
              {formatInr(financials.in_clearing_inr)}
            </p>
            <p className="mt-2 text-xs text-recoverpe-muted">
              Accrued commissions awaiting settlement
            </p>
          </div>
          <div className="p-6">
            <p className="type-eyebrow">Lifetime earned</p>
            <p className="type-stat mt-3">
              {formatInr(financials.lifetime_earned_inr)}
            </p>
            <p className="mt-2 text-xs text-recoverpe-muted">
              {financials.commission_tier_label}
            </p>
          </div>
        </CardContent>
      </Card>

      {withdrawError ? (
        <p className="text-sm text-recoverpe-error">{withdrawError}</p>
      ) : null}
      {withdrawMessage ? (
        <p className="text-sm text-recoverpe-success-ink">{withdrawMessage}</p>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="type-section-title">Tier system</h2>
          <p className="mt-1 text-sm text-recoverpe-muted">
            Your tier is based on closed sales. Higher tiers unlock stronger partner
            economics.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {AGENT_TIERS.map((tierOption) => {
            const isActive = tierOption.id === tier.id;

            return (
              <div
                key={tierOption.id}
                className={`rounded-xl border px-4 py-3 ${
                  isActive
                    ? "border-recoverpe-black bg-recoverpe-canvas"
                    : "border-recoverpe-line bg-recoverpe-white"
                }`}
              >
                <p className="text-sm font-semibold text-recoverpe-black">
                  {tierOption.label}
                </p>
                <p className="mt-1 text-xs text-recoverpe-muted">
                  {tierOption.commissionRateLabel} · {tierOption.minClosedSales}+ sales
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="type-section-title">Discount & quota manager</h2>
          <p className="mt-1 text-sm text-recoverpe-muted">
            Track discount quota consumption and average deal ROI across closed sales.
          </p>
        </CardHeader>
        <CardContent className="grid gap-6 p-6 lg:grid-cols-2">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="type-eyebrow">Discount quota used</p>
              <p className="text-sm font-medium tabular-nums text-recoverpe-black">
                {discount_stats.quota_used_bps / 100}% /{" "}
                {discount_stats.monthly_cap_bps / 100}%
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-recoverpe-fill">
              <div
                className="h-full rounded-full bg-recoverpe-black transition-all duration-150"
                style={{ width: `${quotaUsedPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-recoverpe-muted">
              {discount_stats.cap_remaining_bps / 100}% cap remaining this cycle
            </p>
          </div>

          <div className="rounded-xl border border-recoverpe-line px-4 py-3">
            <p className="type-eyebrow">Average deal ROI</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-recoverpe-black">
              {discount_stats.average_deal_roi_percent}%
            </p>
            <p className="mt-1 text-xs text-recoverpe-muted">
              Commission earned vs discount granted on closed deals
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="type-section-title">Payout ledger</h2>
          <p className="mt-1 text-sm text-recoverpe-muted">
            Settled commissions with UTR references and tax invoice downloads.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-0">
          <div className="grid grid-cols-1 divide-y divide-recoverpe-line border-b border-recoverpe-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="p-6">
              <p className="type-eyebrow">Settled to bank</p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-recoverpe-black">
                {formatInr(financials.available_balance_inr)}
              </p>
            </div>
            <div className="p-6">
              <p className="type-eyebrow">Cash owed to RecoverPe</p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-recoverpe-black">
                {formatInr(financials.pending_remittance_inr)}
              </p>
            </div>
            <div className="p-6">
              <p className="type-eyebrow">Sales closed</p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-recoverpe-black">
                {analytics.sales_closed}
              </p>
            </div>
          </div>

          {payout_history.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-5 w-5" aria-hidden />}
              title="No payouts yet"
              description="Closed merchant onboardings and trail commissions appear here once settled."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Settlement</TableHead>
                  <TableHead>UTR number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payout_history.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="text-recoverpe-black">
                      {payout.settled_at
                        ? formatDateTime(payout.settled_at)
                        : formatDate(payout.created_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-recoverpe-black">
                      {payout.utr_number ?? "—"}
                    </TableCell>
                    <TableCell className="text-recoverpe-black">
                      {payoutKindLabel(payout.kind)}
                    </TableCell>
                    <TableCell className="text-recoverpe-muted">
                      {payout.period_ym ?? "—"}
                    </TableCell>
                    <TableCell className="text-right type-data-primary">
                      {formatInr(payout.amount_inr)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => downloadTdsInvoice(payout)}
                      >
                        <Download className="mr-1.5 h-4 w-4" />
                        TDS / Tax
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
