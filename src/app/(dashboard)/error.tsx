"use client";

import { useEffect } from "react";
import { AppErrorFallback } from "@/components/ui/AppErrorFallback";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] Segment error:", error);
  }, [error]);

  return (
    <AppErrorFallback
      title="We could not load this section"
      description="Your data is safe. Reload this section or return home to continue."
      resetLabel="Reload Section"
      onReset={() => reset()}
      digest={error.digest}
    />
  );
}
