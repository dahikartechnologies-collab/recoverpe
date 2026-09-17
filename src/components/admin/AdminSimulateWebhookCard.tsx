"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { simulateLiveImpsCredit } from "@/lib/diagnostics-client";

export function AdminSimulateWebhookCard() {
  const [ledgerId, setLedgerId] = useState("");
  const [amount, setAmount] = useState("5000");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult("");
    setIsSimulating(true);

    try {
      const parsedAmount = Number(amount);

      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Enter a valid amount in rupees.");
      }

      const response = await simulateLiveImpsCredit({
        ledger_id: ledgerId.trim(),
        amount: parsedAmount,
      });

      setResult(JSON.stringify(response, null, 2));
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to simulate live IMPS credit."
      );
    } finally {
      setIsSimulating(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-medium text-recoverpe-black">
          Simulate Live IMPS Credit
        </p>
        <p className="mt-1 text-sm text-recoverpe-grey-medium">
          Mocks a Razorpay <code className="text-xs">virtual_account.credited</code>{" "}
          webhook for a specific ledger. Works on live Razorpay keys without moving
          real capital — watch the pay page turn green in real time.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div>
            <label
              htmlFor="sim-ledger-id"
              className="mb-1.5 block text-sm font-medium text-recoverpe-black"
            >
              Ledger ID
            </label>
            <Input
              id="sim-ledger-id"
              value={ledgerId}
              onChange={(event) => setLedgerId(event.target.value)}
              placeholder="UUID from the open invoice"
              required
            />
          </div>

          <div>
            <label
              htmlFor="sim-amount"
              className="mb-1.5 block text-sm font-medium text-recoverpe-black"
            >
              Amount (₹)
            </label>
            <Input
              id="sim-amount"
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </div>

          {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

          {result ? (
            <pre className="overflow-x-auto rounded-xl border border-recoverpe-grey-light bg-recoverpe-grey-light p-3 text-xs text-recoverpe-black">
              {result}
            </pre>
          ) : null}

          <Button type="submit" disabled={isSimulating}>
            {isSimulating ? "Simulating…" : "Simulate IMPS credit"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
