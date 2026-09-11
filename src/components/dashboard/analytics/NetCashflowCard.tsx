"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { FINTECH_PALETTE } from "@/components/dashboard/analytics/chart-theme";
import { formatCurrency } from "@/lib/gst";
import { fetchExpenses } from "@/lib/expenses";

interface NetCashflowCardProps {
  collectedThisMonth: number;
  isLoading?: boolean;
}

export function NetCashflowCard({
  collectedThisMonth,
  isLoading = false,
}: NetCashflowCardProps) {
  const [spentThisMonth, setSpentThisMonth] = useState(0);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadExpenseTotals() {
      try {
        const { summary } = await fetchExpenses();

        if (isActive) {
          setSpentThisMonth(summary.total_this_month);
        }
      } catch {
        // A cashflow widget should degrade to money-in rather than break the
        // dashboard when the expenses table is unavailable.
        if (isActive) {
          setSpentThisMonth(0);
        }
      } finally {
        if (isActive) {
          setIsLoadingExpenses(false);
        }
      }
    }

    void loadExpenseTotals();

    return () => {
      isActive = false;
    };
  }, []);

  const pending = isLoading || isLoadingExpenses;
  const netCashflow = collectedThisMonth - spentThisMonth;
  const accentColor =
    netCashflow > 0
      ? FINTECH_PALETTE.emerald
      : netCashflow < 0
        ? FINTECH_PALETTE.coral
        : undefined;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="min-w-0 p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="type-eyebrow truncate">Net Cashflow</p>
          <Link
            href="/dashboard/expenses"
            className="shrink-0 text-xs font-medium text-recoverpe-grey-medium hover:text-recoverpe-black"
          >
            Manage
          </Link>
        </div>
        <p
          className="type-data-primary mt-3 truncate text-2xl"
          style={accentColor ? { color: accentColor } : undefined}
        >
          {pending ? "—" : formatCurrency(netCashflow)}
        </p>
        <dl className="mt-3 space-y-1 text-xs text-recoverpe-grey-medium">
          <div className="flex items-center justify-between gap-2">
            <dt>Money in</dt>
            <dd className="tabular-nums">
              {pending ? "—" : formatCurrency(collectedThisMonth)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt>Money out</dt>
            <dd className="tabular-nums">
              {pending ? "—" : formatCurrency(spentThisMonth)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
