import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCards } from "@/components/dashboard/MetricCardSkeleton";
import { LedgerTableSkeleton } from "@/components/dashboard/LedgerTableSkeleton";

export function StocksPageSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Smart Stocks"
        title="Stocks"
        description="Inventory value, low stock, supplier credit and the cash trapped in slow-moving items."
      />
      <SkeletonCards
        count={3}
        columnsClassName="grid gap-4 sm:grid-cols-3"
      />
      <LedgerTableSkeleton />
    </div>
  );
}
