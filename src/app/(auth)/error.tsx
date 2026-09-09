"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[auth] Segment error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-recoverpe-white px-4 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 text-center">
          <h1 className="text-xl font-semibold text-recoverpe-black">
            Sign-in interrupted
          </h1>
          <p className="text-sm text-slate-600">
            Something went wrong while loading this page. Try again, or return to
            the login screen.
          </p>
          {error.digest ? (
            <p className="font-mono text-xs text-slate-400">
              Reference: {error.digest}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
            <Button type="button" onClick={() => reset()}>
              Try again
            </Button>
            <Link
              href="/login"
              className="focus-ring inline-flex h-10 items-center justify-center rounded-lg border border-recoverpe-grey-light px-4 text-sm font-medium text-recoverpe-black"
            >
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
