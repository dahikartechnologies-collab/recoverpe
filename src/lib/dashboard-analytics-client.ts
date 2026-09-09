import { getAuthHeaders } from "@/lib/auth-headers";
import { DashboardAnalytics } from "@/lib/dashboard-analytics";
import { WorkspaceMode } from "@/types";

export type { DashboardAnalytics };

export async function fetchDashboardAnalytics(
  workspaceMode: WorkspaceMode,
  businessId: string | null
): Promise<DashboardAnalytics> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ workspace_mode: workspaceMode });

  if (workspaceMode === "business" && businessId) {
    params.set("business_id", businessId);
  }

  const response = await fetch(`/api/dashboard/analytics?${params.toString()}`, {
    headers,
  });

  const body = (await response.json()) as DashboardAnalytics & { error?: string };

  if (!response.ok) {
    throw new Error(body.error || "Failed to load dashboard analytics.");
  }

  return body;
}
