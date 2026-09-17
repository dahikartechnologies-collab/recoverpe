export type AgentTab = "performance" | "leads" | "kyc";

export const AGENT_TABS: AgentTab[] = ["performance", "leads", "kyc"];

export function parseAgentTab(hash: string): AgentTab {
  if (hash === "leads" || hash === "kyc") {
    return hash;
  }

  return "performance";
}

export function agentTabHash(tab: AgentTab): string {
  return `#${tab}`;
}
