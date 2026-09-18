import { SupabaseClient } from "@supabase/supabase-js";
import {
  AGENT_ONBOARD_PAYOUT_INR,
  AGENT_TRAIL_PAYOUT_INR,
} from "@/lib/agent/constants";
import { PREMIUM_LIST_PRICE_INR } from "@/lib/agent/discounts";
import { resolveAgentTier, type AgentTierId } from "@/lib/agent/tiers";

export interface AgentFinancials {
  total_commission_earned_inr: number;
  available_balance_inr: number;
  pending_remittance_inr: number;
  commission_tier_label: string;
  available_to_withdraw_inr: number;
  in_clearing_inr: number;
  lifetime_earned_inr: number;
}

export interface AgentDiscountStats {
  total_discounts_granted_inr: number;
  average_discount_percent: number;
  cap_remaining_bps: number;
  quota_used_bps: number;
  monthly_cap_bps: number;
  average_deal_roi_percent: number;
}

export interface AgentPayoutRecord {
  id: string;
  amount_inr: number;
  kind: string;
  status: string;
  created_at: string;
  period_ym: string | null;
  utr_number: string | null;
  settled_at: string | null;
}

export interface AgentAnalytics {
  leads_generated: number;
  sales_closed: number;
  total_earnings_inr: number;
  pending_remittance_inr: number;
  financials: AgentFinancials;
  discount_stats: AgentDiscountStats;
  payout_history: AgentPayoutRecord[];
  agent_tier: AgentTierId;
}

export const EARNINGS_STATUSES = ["accrued", "approved", "paid"] as const;

/** Merchant paid or subscription live — counts as a closed sale. */
export const AGENT_CLOSED_SALE_STATUSES = ["activated", "cash_held"] as const;

export const AGENT_EXCLUDED_REFERRAL_STATUSES = ["cancelled", "clawback"] as const;

export function isClosedAgentSale(status: string): boolean {
  return (AGENT_CLOSED_SALE_STATUSES as readonly string[]).includes(status);
}

export function isCountableAgentReferral(status: string): boolean {
  return !(AGENT_EXCLUDED_REFERRAL_STATUSES as readonly string[]).includes(status);
}

export interface AgentReferralDiscountRow {
  discount_bps: number | null;
  status?: string | null;
}

export function summarizeAgentDiscountStats(input: {
  referrals: AgentReferralDiscountRow[];
  discountCapBps: number;
  listPriceInr?: number;
}): AgentDiscountStats {
  const listPriceInr = input.listPriceInr ?? PREMIUM_LIST_PRICE_INR;
  const closedSales = input.referrals.filter((row) =>
    isClosedAgentSale(String(row.status ?? ""))
  );
  const capReferrals = input.referrals.filter((row) =>
    isCountableAgentReferral(String(row.status ?? ""))
  );

  const totalDiscountsGranted = closedSales.reduce(
    (sum, row) =>
      sum + listPriceInr * (Number(row.discount_bps ?? 0) / 10_000),
    0
  );
  const averageDiscountBps =
    closedSales.length > 0
      ? closedSales.reduce((sum, row) => sum + Number(row.discount_bps ?? 0), 0) /
        closedSales.length
      : 0;
  const maxDiscountUsedBps = capReferrals.reduce(
    (max, row) => Math.max(max, Number(row.discount_bps ?? 0)),
    0
  );

  return {
    total_discounts_granted_inr: roundInr(totalDiscountsGranted),
    average_discount_percent: roundInr(averageDiscountBps / 100),
    cap_remaining_bps: Math.max(0, input.discountCapBps - maxDiscountUsedBps),
    quota_used_bps: maxDiscountUsedBps,
    monthly_cap_bps: input.discountCapBps,
    average_deal_roi_percent: roundInr(
      closedSales.length > 0 && totalDiscountsGranted > 0
        ? ((closedSales.length * AGENT_ONBOARD_PAYOUT_INR) / totalDiscountsGranted) *
            100
        : 0
    ),
  };
}

function roundInr(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function synthesizePayoutUtr(payoutId: string): string {
  return `NEFT${payoutId.replace(/-/g, "").slice(0, 14).toUpperCase()}`;
}

export async function computeAgentAnalytics(
  supabase: SupabaseClient,
  agentId: string,
  walletLiabilityInr: number,
  discountCapBps: number
): Promise<AgentAnalytics> {
  const [
    { count: leadsGenerated, error: leadsError },
    { count: salesClosed, error: salesError },
    { data: referralRows, error: referralError },
    { data: allPayouts, error: payoutError },
  ] = await Promise.all([
    supabase
      .from("agent_referrals")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId),
    supabase
      .from("agent_referrals")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .in("status", [...AGENT_CLOSED_SALE_STATUSES]),
    supabase
      .from("agent_referrals")
      .select("discount_bps, status")
      .eq("agent_id", agentId),
    supabase
      .from("agent_payouts")
      .select("id, amount_inr, kind, status, created_at, period_ym")
      .eq("agent_id", agentId)
      .in("status", [...EARNINGS_STATUSES, "paid"])
      .order("created_at", { ascending: false }),
  ]);

  if (leadsError) {
    throw new Error(leadsError.message || "Failed to count agent referrals.");
  }

  if (salesError) {
    throw new Error(salesError.message || "Failed to count closed sales.");
  }

  if (referralError) {
    throw new Error(referralError.message || "Failed to load referral discounts.");
  }

  if (payoutError) {
    throw new Error(payoutError.message || "Failed to load agent payouts.");
  }

  const referrals = referralRows ?? [];
  const payouts = allPayouts ?? [];
  const earningsPayouts = payouts.filter((row) =>
    EARNINGS_STATUSES.includes(row.status as (typeof EARNINGS_STATUSES)[number])
  );
  const paidPayouts = payouts.filter((row) => row.status === "paid");
  const approvedPayouts = payouts.filter((row) => row.status === "approved");
  const accruedPayouts = payouts.filter((row) => row.status === "accrued");

  const totalEarnings = earningsPayouts.reduce(
    (sum, row) => sum + Number(row.amount_inr ?? 0),
    0
  );
  const availableToWithdraw = approvedPayouts.reduce(
    (sum, row) => sum + Number(row.amount_inr ?? 0),
    0
  );
  const inClearing = accruedPayouts.reduce(
    (sum, row) => sum + Number(row.amount_inr ?? 0),
    0
  );
  const settledBalance = paidPayouts.reduce(
    (sum, row) => sum + Number(row.amount_inr ?? 0),
    0
  );

  const discountStats = summarizeAgentDiscountStats({
    referrals,
    discountCapBps,
  });

  const closedSalesCount = salesClosed ?? 0;
  const agentTier = resolveAgentTier(closedSalesCount);

  return {
    leads_generated: leadsGenerated ?? 0,
    sales_closed: closedSalesCount,
    total_earnings_inr: roundInr(totalEarnings),
    pending_remittance_inr: walletLiabilityInr,
    agent_tier: agentTier.id,
    financials: {
      total_commission_earned_inr: roundInr(totalEarnings),
      available_balance_inr: roundInr(settledBalance),
      pending_remittance_inr: walletLiabilityInr,
      available_to_withdraw_inr: roundInr(availableToWithdraw),
      in_clearing_inr: roundInr(inClearing),
      lifetime_earned_inr: roundInr(totalEarnings),
      commission_tier_label: `${agentTier.label} ${agentTier.commissionRateLabel} · ₹${AGENT_ONBOARD_PAYOUT_INR} onboard · ₹${AGENT_TRAIL_PAYOUT_INR}/mo trail`,
    },
    discount_stats: discountStats,
    payout_history: paidPayouts.map((row) => ({
      id: row.id as string,
      amount_inr: Number(row.amount_inr ?? 0),
      kind: row.kind as string,
      status: row.status as string,
      created_at: row.created_at as string,
      period_ym: (row.period_ym as string | null) ?? null,
      utr_number: synthesizePayoutUtr(row.id as string),
      settled_at: row.created_at as string,
    })),
  };
}
