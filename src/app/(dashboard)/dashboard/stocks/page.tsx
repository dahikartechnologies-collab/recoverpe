import { Suspense } from "react";
import { StocksClient } from "@/components/stocks/StocksClient";

export default function StocksPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-recoverpe-grey-medium">Loading stock...</p>}
    >
      <StocksClient />
    </Suspense>
  );
}
