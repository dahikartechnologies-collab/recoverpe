import { Skeleton } from "@/components/ui/Skeleton";

interface AnalyticsChartSkeletonProps {
  heightClassName?: string;
}

export function AnalyticsChartSkeleton({
  heightClassName = "h-72",
}: AnalyticsChartSkeletonProps) {
  return (
    <div
      className={`rounded-xl border border-recoverpe-grey-light bg-recoverpe-white p-5 ${heightClassName}`}
    >
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-64 max-w-full" />
      <Skeleton className="mt-6 h-[calc(100%-4.5rem)] w-full" />
    </div>
  );
}
