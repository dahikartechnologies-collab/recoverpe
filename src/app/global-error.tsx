"use client";

import { useEffect } from "react";
import { AppErrorFallback } from "@/components/ui/AppErrorFallback";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] Global error boundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-recoverpe-white text-recoverpe-black">
        <AppErrorFallback
          onReset={() => reset()}
          digest={error.digest}
        />
      </body>
    </html>
  );
}
