export type AgentTierId = "bronze" | "silver" | "gold";

export interface AgentTier {
  id: AgentTierId;
  label: string;
  commissionRateLabel: string;
  minClosedSales: number;
}

export const AGENT_TIERS: AgentTier[] = [
  { id: "bronze", label: "Bronze", commissionRateLabel: "10%", minClosedSales: 0 },
  { id: "silver", label: "Silver", commissionRateLabel: "15%", minClosedSales: 5 },
  { id: "gold", label: "Gold", commissionRateLabel: "20%", minClosedSales: 15 },
];

export function resolveAgentTier(closedSales: number): AgentTier {
  if (closedSales >= 15) {
    return AGENT_TIERS[2];
  }

  if (closedSales >= 5) {
    return AGENT_TIERS[1];
  }

  return AGENT_TIERS[0];
}
