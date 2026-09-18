"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
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

  if (!analytics?.financials || !analytics.discount_stats) {
    return (
      <Card>
        <EmptyState
          icon={<Wallet className="h-5 w-5" aria-hidden />}
          title="Performance data unavailable"
          description="We could not load your commission analytics. Refresh the page or try again in a moment."
        />
      </Card>
    );
  }

  const { financials, discount_stats, payout_history = [] } = analytics;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="type-section-title">Financials & Commission</h2>
          <p className="mt-1 text-sm text-recoverpe-muted">
            Accrued commissions, settled payouts, and cash you still owe RecoverPe.
          </p>
        </CardHeader>
        <CardContent className="grid p-0 sm:grid-cols-2 sm:divide-x divide-y sm:divide-y-0 divide-recoverpe-line">
          <div className="p-6">
            <p className="type-eyebrow">Total commission earned</p>
            <p className="type-stat mt-3">
              {formatInr(financials.total_commission_earned_inr)}
            </p>
            <p className="mt-2 text-xs text-recoverpe-muted">
              Accrued, approved, and paid
            </p>
          </div>
          <div className="p-6">
            <p className="type-eyebrow">Available balance</p>
            <p className="type-stat mt-3">
              {formatInr(financials.available_balance_inr)}
            </p>
            <p className="mt-2 text-xs text-recoverpe-success-ink">
              Settled to your bank
            </p>
          </div>
          <div className="p-6">
            <p className="type-eyebrow">Pending remittance</p>
            <p className="type-stat mt-3">
              {formatInr(financials.pending_remittance_inr)}
            </p>
            <p className="mt-2 text-xs text-recoverpe-muted">
              Cash still owed to RecoverPe
            </p>
          </div>
          <div className="p-6">
            <p className="type-eyebrow">Commission tier</p>
            <p className="mt-3 text-sm font-medium tracking-tight text-recoverpe-black">
              {financials.commission_tier_label}
            </p>
            <p className="mt-2 text-xs text-recoverpe-muted">
              Discount cap {agent.discount_cap_bps / 100}% · {agent.open_cash_tickets}/5
              open tickets
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="type-section-title">Discounts & Pricing Quotas</h2>
          <p className="mt-1 text-sm text-recoverpe-muted">
            How much you have discounted Premium for merchants in your pipeline.
          </p>
        </CardHeader>
        <CardContent className="grid p-0 sm:grid-cols-3 sm:divide-x divide-y sm:divide-y-0 divide-recoverpe-line">
          <div className="p-6">
            <p className="type-eyebrow">Total discounts granted</p>
            <p className="mt-3 text-xl font-semibold tracking-tight tabular-nums text-recoverpe-black">
              {formatInr(discount_stats.total_discounts_granted_inr)}
            </p>
          </div>
          <div className="p-6">
            <p className="type-eyebrow">Average discount</p>
            <p className="mt-3 text-xl font-semibold tracking-tight tabular-nums text-recoverpe-black">
              {discount_stats.average_discount_percent}%
            </p>
          </div>
          <div className="p-6">
            <p className="type-eyebrow">Cap remaining</p>
            <p className="mt-3 text-xl font-semibold tracking-tight tabular-nums text-recoverpe-black">
              {discount_stats.cap_remaining_bps / 100}%
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-recoverpe-fill">
              <div
                className="h-full rounded-full bg-recoverpe-black transition-all duration-150"
                style={{
                  width: `${Math.min(
                    100,
                    (discount_stats.cap_remaining_bps /
                      Math.max(agent.discount_cap_bps, 1)) *
                      100
                  )}%`,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="type-section-title">Settlement & payout history</h2>
          <p className="mt-1 text-sm text-recoverpe-muted">
            Commissions paid to your linked bank account.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {payout_history.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-5 w-5" aria-hidden />}
              title="No payouts yet"
              description="Closed merchant onboardings and trail commissions appear here once settled."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payout_history.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="text-recoverpe-black">
                      {formatDate(payout.created_at)}
                    </TableCell>
                    <TableCell className="text-recoverpe-black">
                      {payoutKindLabel(payout.kind)}
                    </TableCell>
                    <TableCell className="text-recoverpe-muted">
                      {payout.period_ym ?? "—"}
                    </TableCell>
                    <TableCell className="text-right type-data-primary">
                      {formatInr(payout.amount_inr)}
                    </TableCell>
                    <TableCell>
                      <Badge tone="success">{payout.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-6 p-6 sm:grid-cols-2">
          <div>
            <p className="type-eyebrow">Leads generated</p>
            <p className="mt-2 text-lg font-semibold tabular-nums text-recoverpe-black">
              {analytics.leads_generated}
            </p>
          </div>
          <div>
            <p className="type-eyebrow">Sales closed</p>
            <p className="mt-2 text-lg font-semibold tabular-nums text-recoverpe-black">
              {analytics.sales_closed}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
