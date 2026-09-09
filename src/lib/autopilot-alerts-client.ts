import { getAuthHeaders } from "@/lib/auth-headers";
import { AutopilotEscalationAlert } from "@/types";
import { WorkspaceMode } from "@/types";

export async function fetchAutopilotAlerts(
  workspaceMode: WorkspaceMode,
  businessId: string | null
): Promise<AutopilotEscalationAlert[]> {
  const params = new URLSearchParams({ workspace_mode: workspaceMode });

  if (workspaceMode === "business" && businessId) {
    params.set("business_id", businessId);
  }

  const headers = await getAuthHeaders();
  const response = await fetch(`/api/dashboard/autopilot-alerts?${params.toString()}`, {
    headers,
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    alerts?: AutopilotEscalationAlert[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Failed to load autopilot alerts.");
  }

  return payload.alerts ?? [];
}
