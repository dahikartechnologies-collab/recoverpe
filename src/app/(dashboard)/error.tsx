"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

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
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Dashboard unavailable
          </p>
          <h1 className="text-xl font-semibold text-recoverpe-black">
            We could not load this section
          </h1>
          <p className="text-sm text-slate-600">
            Your data is safe. Reload this section to continue working.
          </p>
          {error.digest ? (
            <p className="font-mono text-xs text-slate-400">
              Reference: {error.digest}
            </p>
          ) : null}
          <div className="pt-2">
            <Button type="button" onClick={() => reset()}>
              Reload Section
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
