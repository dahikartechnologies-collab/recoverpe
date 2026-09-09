"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { FINTECH_PALETTE } from "@/components/dashboard/analytics/chart-theme";
import { formatCurrency } from "@/lib/gst";
import { DashboardAnalyticsSummary } from "@/lib/dashboard-analytics";

interface MetricsGridProps {
  summary: DashboardAnalyticsSummary;
  isLoading?: boolean;
}

interface MetricTrendProps {
  changePercent: number | null | undefined;
  invertSentiment?: boolean;
}

function MetricTrend({ changePercent, invertSentiment = false }: MetricTrendProps) {
  if (changePercent === null || changePercent === undefined) {
    return null;
  }

  const isPositive = changePercent > 0;
  const isNegative = changePercent < 0;

  const isGood = invertSentiment ? isNegative : isPositive;
  const isBad = invertSentiment ? isPositive : isNegative;

  const color = isGood
    ? FINTECH_PALETTE.emerald
    : isBad
      ? FINTECH_PALETTE.coral
      : FINTECH_PALETTE.obsidian;

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : null;
  const prefix = isPositive ? "+" : "";

  return (
    <p
      className="mt-2 flex items-center gap-1 text-xs font-medium tabular-nums"
      style={{ color }}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={2.25} /> : null}
      <span>
        {prefix}
        {changePercent}% from last month
      </span>
    </p>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  description: string;
  isLoading?: boolean;
  changePercent?: number | null;
  invertTrendSentiment?: boolean;
  accentColor?: string;
}

function MetricCard({
  label,
  value,
  description,
  isLoading,
  changePercent,
  invertTrendSentiment,
  accentColor,
}: MetricCardProps) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="min-w-0 p-5">
        <p className="type-eyebrow truncate">{label}</p>
        <p
          className="type-data-primary mt-3 truncate text-2xl"
          style={accentColor ? { color: accentColor } : undefined}
        >
          {isLoading ? "—" : value}
        </p>
        {!isLoading ? (
          <MetricTrend
            changePercent={changePercent}
            invertSentiment={invertTrendSentiment}
          />
        ) : null}
        <p className="type-data-secondary mt-2 leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

export function MetricsGrid({ summary, isLoading = false }: MetricsGridProps) {
  const collectionRateAccent =
    summary.collectionRate >= 70
      ? FINTECH_PALETTE.emerald
      : summary.collectionRate >= 40
        ? FINTECH_PALETTE.gold
        : summary.collectionRate > 0
          ? FINTECH_PALETTE.coral
          : undefined;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Total Outstanding"
        value={formatCurrency(summary.totalOutstanding)}
        description="Open receivables across active ledgers."
        isLoading={isLoading}
        changePercent={summary.totalOutstandingChangePercent}
        invertTrendSentiment
      />
      <MetricCard
        label="Collected This Month"
        value={formatCurrency(summary.collectedThisMonth)}
        description="Payments logged in the current calendar month."
        isLoading={isLoading}
        changePercent={summary.collectedThisMonthChangePercent}
      />
      <MetricCard
        label="Active Defaulters"
        value={summary.activeDefaulters.toLocaleString("en-IN")}
        description="Unique debtors with overdue balances."
        isLoading={isLoading}
        changePercent={summary.activeDefaultersChangePercent}
        invertTrendSentiment
      />
      <MetricCard
        label="Collection Rate"
        value={`${summary.collectionRate}%`}
        description="Collected vs invoiced volume this month."
        isLoading={isLoading}
        changePercent={summary.collectionRateChangePercent}
        accentColor={collectionRateAccent}
      />
    </div>
  );
}
