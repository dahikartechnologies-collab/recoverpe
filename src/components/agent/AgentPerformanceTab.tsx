"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AgentMeResponse } from "@/lib/agent-client";
import { payoutKindLabel } from "@/lib/agent/discounts";
import { Wallet } from "lucide-react";

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

interface AgentPerformanceTabProps {
  payload: AgentMeResponse;
}

export function AgentPerformanceTab({ payload }: AgentPerformanceTabProps) {
  const { agent, analytics } = payload;
  const { financials, discount_stats, payout_history } = analytics;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-recoverpe-black">
            Financials & Commission
          </h2>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Accrued commissions, settled payouts, and cash you still owe RecoverPe.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-recoverpe-grey-light p-4">
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Total commission earned
            </p>
            <p className="mt-1 text-2xl font-semibold text-recoverpe-success">
              {formatInr(financials.total_commission_earned_inr)}
            </p>
          </div>
          <div className="rounded-xl border border-recoverpe-grey-light p-4">
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Available balance
            </p>
            <p className="mt-1 text-2xl font-semibold text-recoverpe-black">
              {formatInr(financials.available_balance_inr)}
            </p>
          </div>
          <div className="rounded-xl border border-recoverpe-grey-light p-4">
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Pending remittance
            </p>
            <p className="mt-1 text-2xl font-semibold text-recoverpe-black">
              {formatInr(financials.pending_remittance_inr)}
            </p>
          </div>
          <div className="rounded-xl border border-recoverpe-grey-light p-4">
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Commission tier
            </p>
            <p className="mt-1 text-sm font-medium text-recoverpe-black">
              {financials.commission_tier_label}
            </p>
            <p className="mt-2 text-xs text-recoverpe-grey-medium">
              Discount cap {agent.discount_cap_bps / 100}% · {agent.open_cash_tickets}/5
              open tickets
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-recoverpe-black">
            Discounts & Pricing Quotas
          </h2>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            How much you have discounted Premium for merchants in your pipeline.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Total discounts granted
            </p>
            <p className="mt-1 text-xl font-semibold text-recoverpe-black">
              {formatInr(discount_stats.total_discounts_granted_inr)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Average discount
            </p>
            <p className="mt-1 text-xl font-semibold text-recoverpe-black">
              {discount_stats.average_discount_percent}%
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Cap remaining
            </p>
            <p className="mt-1 text-xl font-semibold text-recoverpe-black">
              {discount_stats.cap_remaining_bps / 100}%
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-recoverpe-black">
            Settlement & payout history
          </h2>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Commissions paid to your linked bank account.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {payout_history.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-5 w-5" aria-hidden />}
              title="No payouts yet"
              description="Closed merchant onboardings and trail commissions appear here once settled."
            />
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-recoverpe-grey-light text-recoverpe-grey-medium">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Period</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payout_history.map((payout) => (
                  <tr
                    key={payout.id}
                    className="border-b border-recoverpe-grey-light"
                  >
                    <td className="px-3 py-3 text-recoverpe-black">
                      {formatDate(payout.created_at)}
                    </td>
                    <td className="px-3 py-3 text-recoverpe-black">
                      {payoutKindLabel(payout.kind)}
                    </td>
                    <td className="px-3 py-3 text-recoverpe-grey-medium">
                      {payout.period_ym ?? "—"}
                    </td>
                    <td className="px-3 py-3 font-medium text-recoverpe-success">
                      {formatInr(payout.amount_inr)}
                    </td>
                    <td className="px-3 py-3 capitalize text-recoverpe-black">
                      {payout.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Leads generated
            </p>
            <p className="mt-1 text-lg font-semibold text-recoverpe-black">
              {analytics.leads_generated}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Sales closed
            </p>
            <p className="mt-1 text-lg font-semibold text-recoverpe-black">
              {analytics.sales_closed}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
