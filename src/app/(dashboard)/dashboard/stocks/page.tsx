import { Suspense } from "react";
import { StocksClient } from "@/components/stocks/StocksClient";
import { StocksPageSkeleton } from "@/components/stocks/StocksPageSkeleton";

export default function StocksPage() {
  return (
    <Suspense fallback={<StocksPageSkeleton />}>
      <StocksClient />
    </Suspense>
  );
}
