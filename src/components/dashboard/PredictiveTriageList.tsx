"use client";

import { useMemo } from "react";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/gst";
import { isLedgerDynamicallyOverdue } from "@/lib/ledger-status";
import { LedgerWithContact } from "@/types";

interface PredictiveTriageListProps {
  ledgers: LedgerWithContact[];
  isLoading?: boolean;
  isPremium: boolean;
  onUpgrade: () => void;
}

function PredictiveTriageSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <li
          key={index}
          className="rounded-md border border-recoverpe-grey-light px-5 py-4"
        >
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-3 h-3 w-64" />
        </li>
      ))}
    </ul>
  );
}

function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function PredictiveTriageList({
  ledgers,
  isLoading = false,
  isPremium,
  onUpgrade,
}: PredictiveTriageListProps) {
  const triageLedgers = useMemo(() => {
    return ledgers
      .filter(
        (ledger) =>
          ledger.balance_due > 0 &&
          !["paid", "cancelled", "refunded"].includes(ledger.status)
      )
      .sort((left, right) => {
        const leftScore = left.contact.risk_score ?? 50;
        const rightScore = right.contact.risk_score ?? 50;

        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }

        return right.balance_due - left.balance_due;
      })
      .slice(0, 8);
  }, [ledgers]);

  return (
    <Card>
      <CardContent className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-recoverpe-black">
            Predictive Triage List
          </h2>
          <p className="type-data-secondary mt-2 text-sm">
            Open receivables ranked by AI payment probability (highest risk first).
          </p>
        </div>

        <div className="relative">
          {isLoading ? (
            <PredictiveTriageSkeleton />
          ) : triageLedgers.length === 0 ? (
            <p className="type-data-secondary text-sm">
              No open invoices to triage. Your collections queue is clear.
            </p>
          ) : (
            <ul
              className={`space-y-3 ${!isPremium ? "pointer-events-none select-none blur-sm" : ""}`}
            >
              {triageLedgers.map((ledger) => (
                <li
                  key={ledger.id}
                  className="rounded-md border border-recoverpe-grey-light px-5 py-4 transition-all duration-200 ease-out hover:bg-recoverpe-grey-light/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-recoverpe-black">
                          {ledger.contact.name}
                        </p>
                        <RiskBadge
                          tier={ledger.contact.payment_reliability_tier}
                          riskScore={ledger.contact.risk_score}
                        />
                      </div>
                      <p className="type-data-secondary mt-1.5 text-sm">
                        <span className="type-data-primary">
                          {formatCurrency(ledger.balance_due)}
                        </span>{" "}
                        outstanding
                        {ledger.invoice_number ? ` · ${ledger.invoice_number}` : ""}
                      </p>
                      <p className="type-data-secondary mt-1 text-sm">
                        Due {formatDueDate(ledger.due_date)}
                        {isLedgerDynamicallyOverdue(ledger) ? " · Overdue" : ""}
                      </p>
                    </div>
                    <p className="text-xs font-medium tabular-nums text-recoverpe-grey-medium">
                      Risk {ledger.contact.risk_score ?? 50}/100
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!isPremium && triageLedgers.length > 0 ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-white/70 p-6 backdrop-blur-sm">
              <div className="max-w-md text-center">
                <p className="text-sm font-semibold text-recoverpe-black">
                  AI Payment Predictions are a Premium feature
                </p>
                <p className="mt-2 text-sm text-recoverpe-grey-medium">
                  Upgrade to Premium (₹1,999/mo) to unlock AI Payment Predictions
                  and prioritize collections.
                </p>
                <Button type="button" className="mt-4" onClick={onUpgrade}>
                  Upgrade to Premium
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
