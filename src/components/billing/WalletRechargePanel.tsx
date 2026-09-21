"use client";

import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  calculateWalletRechargeBreakdown,
  WALLET_RECHARGE_MAX_INR,
  WALLET_RECHARGE_MIN_INR,
} from "@/lib/vapi-pricing";
import { startWalletRechargeCheckout } from "@/lib/razorpay-client";

interface WalletRechargePanelProps {
  currentBalanceInr: number;
  prefill?: {
    email?: string;
    contact?: string;
  };
  onSuccess?: (baseAmountInr: number) => void;
}

function formatInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export function WalletRechargePanel({
  currentBalanceInr,
  prefill,
  onSuccess,
}: WalletRechargePanelProps) {
  const [baseAmountInput, setBaseAmountInput] = useState("1000");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const parsedBaseAmount = Number(baseAmountInput);
  const breakdown = useMemo(() => {
    if (
      !Number.isFinite(parsedBaseAmount) ||
      parsedBaseAmount < WALLET_RECHARGE_MIN_INR ||
      parsedBaseAmount > WALLET_RECHARGE_MAX_INR
    ) {
      return null;
    }

    return calculateWalletRechargeBreakdown(Math.trunc(parsedBaseAmount));
  }, [parsedBaseAmount]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!breakdown) {
      setError(
        `Enter an amount between ₹${WALLET_RECHARGE_MIN_INR} and ₹${WALLET_RECHARGE_MAX_INR.toLocaleString("en-IN")}.`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await startWalletRechargeCheckout({
        baseAmount: breakdown.base_amount_inr,
        prefill,
        onSuccess: () => onSuccess?.(breakdown.base_amount_inr),
      });
    } catch (checkoutError) {
      if (
        checkoutError instanceof Error &&
        checkoutError.message !== "Payment cancelled."
      ) {
        setError(checkoutError.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
      <div>
        <p className="text-xs text-recoverpe-muted">
          Current balance:{" "}
          <span className="font-medium text-recoverpe-black">
            {formatInr(currentBalanceInr)}
          </span>
        </p>
      </div>

      <div>
        <label
          htmlFor="walletRechargeAmount"
          className="mb-1.5 block text-sm font-medium text-recoverpe-black"
        >
          Recharge Amount (₹)
        </label>
        <Input
          id="walletRechargeAmount"
          type="number"
          min={WALLET_RECHARGE_MIN_INR}
          max={WALLET_RECHARGE_MAX_INR}
          step={1}
          value={baseAmountInput}
          onChange={(event) => setBaseAmountInput(event.target.value)}
          required
        />
        <p className="mt-1 text-xs text-recoverpe-muted">
          Min ₹{WALLET_RECHARGE_MIN_INR} · Max ₹
          {WALLET_RECHARGE_MAX_INR.toLocaleString("en-IN")}. GST is charged on top;
          only the base amount is credited to your wallet.
        </p>
      </div>

      {breakdown ? (
        <div className="rounded-lg border border-recoverpe-line bg-recoverpe-fill px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-recoverpe-muted">Base Amount</span>
            <span className="font-medium tabular-nums text-recoverpe-black">
              {formatInr(breakdown.base_amount_inr)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-recoverpe-muted">GST (18%)</span>
            <span className="font-medium tabular-nums text-recoverpe-black">
              {formatInr(breakdown.gst_amount_inr)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-recoverpe-line pt-2">
            <span className="font-medium text-recoverpe-black">Total Payable</span>
            <span className="font-semibold tabular-nums text-recoverpe-black">
              {formatInr(breakdown.total_payable_inr)}
            </span>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

      <Button type="submit" disabled={isSubmitting || !breakdown}>
        {isSubmitting ? "Processing…" : "Pay Now"}
      </Button>
    </form>
  );
}
