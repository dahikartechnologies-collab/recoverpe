"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

interface AppErrorFallbackProps {
  title?: string;
  description?: string;
  resetLabel?: string;
  onReset?: () => void;
  showReturnHome?: boolean;
  digest?: string;
}

export function AppErrorFallback({
  title = "Something went wrong",
  description = "An unexpected error interrupted this page. Your data is safe. You can try again or return home.",
  resetLabel = "Try again",
  onReset,
  showReturnHome = true,
  digest,
}: AppErrorFallbackProps) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-recoverpe-white px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-recoverpe-muted">
            RecoverPe
          </p>
          <h1 className="text-xl font-semibold text-recoverpe-black">{title}</h1>
          <p className="text-sm text-recoverpe-muted">{description}</p>
          {digest ? (
            <p className="font-mono text-xs text-recoverpe-muted">
              Reference: {digest}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
            {onReset ? (
              <Button type="button" onClick={onReset}>
                {resetLabel}
              </Button>
            ) : null}
            {showReturnHome ? (
              <Link
                href="/"
                className="focus-ring inline-flex h-10 items-center justify-center rounded-md border border-recoverpe-line-strong bg-recoverpe-white px-4 text-sm font-medium text-recoverpe-black hover:bg-recoverpe-fill"
              >
                Return Home
              </Link>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
