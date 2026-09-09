"use client";

import { FormEvent, useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  fetchDiagnosticsHealth,
  simulateSmartCollectPayment,
} from "@/lib/diagnostics-client";
import {
  DiagnosticServiceStatus,
  DiagnosticsHealthResponse,
} from "@/types";

function statusLabel(status: DiagnosticServiceStatus): string {
  return status === "ok" ? "OK" : "Failed";
}

function statusClass(status: DiagnosticServiceStatus): string {
  return status === "ok" ? "text-recoverpe-success" : "text-recoverpe-error";
}

export function AdminDiagnosticsPanel() {
  const [health, setHealth] = useState<DiagnosticsHealthResponse | null>(null);
  const [healthError, setHealthError] = useState("");
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const [contactId, setContactId] = useState("");
  const [amountRupees, setAmountRupees] = useState("1000");
  const [simulateError, setSimulateError] = useState("");
  const [simulateResult, setSimulateResult] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);

  const runHealthCheck = useCallback(async () => {
    setIsCheckingHealth(true);
    setHealthError("");

    try {
      const result = await fetchDiagnosticsHealth();
      setHealth(result);
    } catch (error) {
      setHealth(null);
      setHealthError(
        error instanceof Error
          ? error.message
          : "Failed to run integration health check."
      );
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  async function handleSimulatePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSimulateError("");
    setSimulateResult("");
    setIsSimulating(true);

    try {
      const parsedAmount = Number(amountRupees);

      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Enter a valid amount in rupees.");
      }

      const result = await simulateSmartCollectPayment({
        contact_id: contactId.trim(),
        amount_rupees: parsedAmount,
      });

      setSimulateResult(JSON.stringify(result, null, 2));
    } catch (error) {
      setSimulateError(
        error instanceof Error
          ? error.message
          : "Failed to simulate Smart Collect payment."
      );
    } finally {
      setIsSimulating(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-recoverpe-black">
            Integration Health
          </p>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Lightweight connectivity probes for Supabase, Firebase Admin, Upstash
            Redis, and Razorpay.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void runHealthCheck()}
            disabled={isCheckingHealth}
          >
            {isCheckingHealth ? "Checking…" : "Run health check"}
          </Button>

          {healthError ? (
            <p className="text-sm text-recoverpe-error">{healthError}</p>
          ) : null}

          {health ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-recoverpe-black">
                Overall:{" "}
                <span
                  className={
                    health.status === "ok"
                      ? "text-recoverpe-success"
                      : "text-recoverpe-error"
                  }
                >
                  {health.status === "ok" ? "Healthy" : "Degraded"}
                </span>
              </p>
              <ul className="grid gap-2 text-sm sm:grid-cols-2">
                {(
                  Object.entries(health.services) as Array<
                    [keyof DiagnosticsHealthResponse["services"], DiagnosticServiceStatus]
                  >
                ).map(([service, status]) => (
                  <li
                    key={service}
                    className="flex items-center justify-between rounded-md border border-recoverpe-grey-light px-3 py-2"
                  >
                    <span className="capitalize text-recoverpe-black">{service}</span>
                    <span className={`font-medium ${statusClass(status)}`}>
                      {statusLabel(status)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-recoverpe-grey-medium">
                Checked at {new Date(health.checked_at).toLocaleString("en-IN")}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-recoverpe-black">
            Simulate Smart Collect Payment
          </p>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Triggers wallet credit and FIFO ledger reconciliation locally without
            sending real money. Requires a contact with a provisioned virtual
            account.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(event) => void handleSimulatePayment(event)}>
            <div>
              <label
                htmlFor="diag-contact-id"
                className="mb-1.5 block text-sm font-medium text-recoverpe-black"
              >
                Contact ID
              </label>
              <Input
                id="diag-contact-id"
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
                placeholder="UUID from vendor directory"
                required
              />
            </div>

            <div>
              <label
                htmlFor="diag-amount"
                className="mb-1.5 block text-sm font-medium text-recoverpe-black"
              >
                Amount (₹)
              </label>
              <Input
                id="diag-amount"
                type="number"
                min="1"
                step="0.01"
                value={amountRupees}
                onChange={(event) => setAmountRupees(event.target.value)}
                required
              />
            </div>

            {simulateError ? (
              <p className="text-sm text-recoverpe-error">{simulateError}</p>
            ) : null}

            {simulateResult ? (
              <pre className="overflow-x-auto rounded-md border border-recoverpe-grey-light bg-recoverpe-grey-light p-3 text-xs text-recoverpe-black">
                {simulateResult}
              </pre>
            ) : null}

            <Button type="submit" disabled={isSimulating}>
              {isSimulating ? "Simulating…" : "Simulate payment"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
