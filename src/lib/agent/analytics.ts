import { SupabaseClient } from "@supabase/supabase-js";

export interface AgentAnalytics {
  leads_generated: number;
  sales_closed: number;
  total_earnings_inr: number;
  pending_remittance_inr: number;
}

const EARNINGS_STATUSES = ["accrued", "approved", "paid"] as const;

export async function computeAgentAnalytics(
  supabase: SupabaseClient,
  agentId: string,
  walletLiabilityInr: number
): Promise<AgentAnalytics> {
  const { count: leadsGenerated, error: leadsError } = await supabase
    .from("agent_referrals")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId);

  if (leadsError) {
    throw new Error(leadsError.message || "Failed to count agent referrals.");
  }

  const { count: salesClosed, error: salesError } = await supabase
    .from("agent_referrals")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("status", "activated");

  if (salesError) {
    throw new Error(salesError.message || "Failed to count closed sales.");
  }

  const { data: payouts, error: payoutError } = await supabase
    .from("agent_payouts")
    .select("amount_inr, status")
    .eq("agent_id", agentId)
    .in("status", [...EARNINGS_STATUSES]);

  if (payoutError) {
    throw new Error(payoutError.message || "Failed to load agent payouts.");
  }

  const totalEarnings = (payouts ?? []).reduce(
    (sum, row) => sum + Number(row.amount_inr ?? 0),
    0
  );

  return {
    leads_generated: leadsGenerated ?? 0,
    sales_closed: salesClosed ?? 0,
    total_earnings_inr: Math.round((totalEarnings + Number.EPSILON) * 100) / 100,
    pending_remittance_inr: walletLiabilityInr,
  };
}
