"use client";

import { useEffect } from "react";
import { AppErrorFallback } from "@/components/ui/AppErrorFallback";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] Root error boundary:", error);
  }, [error]);

  return (
    <AppErrorFallback
      onReset={() => reset()}
      digest={error.digest}
    />
  );
}
