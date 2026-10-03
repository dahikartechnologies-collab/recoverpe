import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export function MetricCardSkeleton() {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="min-w-0 space-y-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-36 md:h-10 md:w-44" />
        <Skeleton className="h-3 w-full max-w-[12rem]" />
      </CardContent>
    </Card>
  );
}

export function SkeletonCards({
  count = 4,
  columnsClassName = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
}: {
  count?: number;
  columnsClassName?: string;
}) {
  return (
    <div className={columnsClassName}>
      {Array.from({ length: count }, (_, index) => (
        <MetricCardSkeleton key={index} />
      ))}
    </div>
  );
}
