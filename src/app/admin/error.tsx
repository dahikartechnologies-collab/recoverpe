"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] Segment error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Admin console
          </p>
          <h1 className="text-xl font-semibold text-recoverpe-black">
            Admin view failed to load
          </h1>
          <p className="text-sm text-slate-600">
            Reload this section to continue reviewing platform data.
          </p>
          {error.digest ? (
            <p className="font-mono text-xs text-slate-400">
              Reference: {error.digest}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
            <Button type="button" onClick={() => reset()}>
              Reload Section
            </Button>
            <Link
              href="/admin"
              className="focus-ring inline-flex h-10 items-center justify-center rounded-lg border border-recoverpe-grey-light px-4 text-sm font-medium text-recoverpe-black"
            >
              Admin home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
