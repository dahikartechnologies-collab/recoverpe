import { AnalyticsChartSkeleton } from "@/components/dashboard/analytics/AnalyticsChartSkeleton";
import { LedgerTableSkeleton } from "@/components/dashboard/LedgerTableSkeleton";
import { MetricCardSkeleton } from "@/components/dashboard/MetricCardSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <AnalyticsChartSkeleton heightClassName="h-72" />
        <AnalyticsChartSkeleton heightClassName="h-72" />
      </div>

      <LedgerTableSkeleton />
    </div>
  );
}
