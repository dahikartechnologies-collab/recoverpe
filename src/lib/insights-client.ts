import { getAuthHeaders } from "@/lib/auth-headers";
import type { BusinessPulse, InsightNarrative } from "@/lib/business-pulse";
import { WorkspaceMode } from "@/types";

export interface BusinessInsightsResponse {
  is_premium: boolean;
  pulse: BusinessPulse;
  narrative: InsightNarrative | null;
}

export async function fetchBusinessInsights(
  workspaceMode: WorkspaceMode,
  businessId: string | null
): Promise<BusinessInsightsResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ workspace_mode: workspaceMode });

  if (workspaceMode === "business" && businessId) {
    params.set("business_id", businessId);
  }

  const response = await fetch(`/api/insights?${params.toString()}`, { headers });
  const payload = (await response.json()) as BusinessInsightsResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Failed to load insights.");
  }

  return payload;
}
