"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export default function AgentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Card>
        <CardContent className="space-y-4 p-6">
          <p className="text-sm font-medium text-recoverpe-black">
            Agent dashboard failed to load
          </p>
          <p className="text-sm text-recoverpe-error">
            {error.message || "An unexpected error occurred."}
          </p>
          <Button type="button" size="sm" onClick={() => reset()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
