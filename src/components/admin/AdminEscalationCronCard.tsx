"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { triggerDailyEscalationCron } from "@/lib/admin-client";

export function AdminEscalationCronCard() {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [responseJson, setResponseJson] = useState("");

  async function handleTrigger() {
    setError("");
    setResponseJson("");
    setIsRunning(true);

    try {
      const result = await triggerDailyEscalationCron();
      setResponseJson(JSON.stringify(result, null, 2));
    } catch (triggerError) {
      setError(
        triggerError instanceof Error
          ? triggerError.message
          : "Failed to trigger daily escalation cron."
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-recoverpe-black">
          Daily Escalation Cron
        </h2>
        <p className="mt-1 text-sm text-recoverpe-grey-medium">
          Manually invoke the overdue reminder job to test WhatsApp, SMS, and
          email escalations for aging ledgers without waiting for the Vercel
          schedule.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" onClick={() => void handleTrigger()} disabled={isRunning}>
          {isRunning ? "Running escalation cron..." : "Trigger Daily Escalation Cron"}
        </Button>

        {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

        {responseJson ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-recoverpe-black">Raw response</p>
            <pre className="max-h-[420px] overflow-auto rounded-md border border-recoverpe-grey-light bg-recoverpe-grey-light/20 p-4 text-xs leading-5 text-recoverpe-black">
              {responseJson}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
