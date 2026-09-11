"use client";

import { Suspense } from "react";
import { AnalyticsChartSkeleton } from "@/components/dashboard/analytics/AnalyticsChartSkeleton";
import {
  LazyArSankeyFlow,
  LazyCashFlowChart,
  LazyDsoCohortHeatmap,
} from "@/components/dashboard/analytics/lazy-analytics-charts";
import { MetricsGrid } from "@/components/dashboard/analytics/MetricsGrid";
import { NetCashflowCard } from "@/components/dashboard/analytics/NetCashflowCard";
import { useDashboardAnalytics } from "@/hooks/use-dashboard-analytics";
import { WorkspaceMode } from "@/types";

interface DashboardAnalyticsSectionProps {
  workspaceMode: WorkspaceMode;
  businessId?: string | null;
}

export function DashboardAnalyticsSection({
  workspaceMode,
  businessId = null,
}: DashboardAnalyticsSectionProps) {
  const { analytics, error, isLoading } = useDashboardAnalytics(
    workspaceMode,
    businessId
  );

  return (
    <section className="space-y-4">
      <div>
        <p className="type-eyebrow">Command center</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-recoverpe-black">
          Recovery analytics
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-recoverpe-grey-medium">
          Predictive cash flow and aging intelligence scoped to your workspace
          permissions.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-recoverpe-grey-light px-4 py-3 text-sm text-recoverpe-error">
          {error}
        </p>
      ) : null}

      <MetricsGrid summary={analytics.summary} isLoading={isLoading} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <NetCashflowCard
          collectedThisMonth={analytics.summary.collectedThisMonth}
          isLoading={isLoading}
        />
      </div>

      <Suspense fallback={<AnalyticsChartSkeleton heightClassName="h-80" />}>
        <LazyCashFlowChart data={analytics.cashFlow} isLoading={isLoading} />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <Suspense fallback={<AnalyticsChartSkeleton />}>
            <LazyArSankeyFlow data={analytics.sankey} isLoading={isLoading} />
          </Suspense>
        </div>
        <div className="min-w-0">
          <Suspense fallback={<AnalyticsChartSkeleton />}>
            <LazyDsoCohortHeatmap data={analytics.dsoCohort} isLoading={isLoading} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
