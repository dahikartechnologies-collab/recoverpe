import { getAuthHeaders } from "@/lib/auth-headers";
import { ReconciliationActivityItem } from "@/lib/dashboard-activity-feed";
import { WorkspaceMode } from "@/types";

export async function fetchReconciliationActivityFeed(
  workspaceMode: WorkspaceMode,
  businessId: string | null
): Promise<ReconciliationActivityItem[]> {
  const params = new URLSearchParams({ workspace_mode: workspaceMode });

  if (workspaceMode === "business" && businessId) {
    params.set("business_id", businessId);
  }

  const headers = await getAuthHeaders();
  const response = await fetch(`/api/dashboard/activity-feed?${params.toString()}`, {
    headers,
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    items?: ReconciliationActivityItem[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Failed to load activity feed.");
  }

  return payload.items ?? [];
}
