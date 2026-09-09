import { getAuthHeaders } from "@/lib/auth-headers";
import { WorkspaceMode } from "@/types";

export interface WallOfShameEntry {
  ledger_id: string;
  contact_name: string;
  balance_due: number;
  due_date: string;
  days_overdue: number;
}

export interface HostileCallAlert {
  communication_log_id: string;
  ledger_id: string;
  contact_name: string;
  balance_due: number;
  executive_summary: string | null;
  executed_at: string;
}

export interface PendingVerificationAlert {
  verification_id: string;
  ledger_id: string;
  contact_name: string;
  balance_due: number;
  claimed_amount: number | null;
  screenshot_url: string;
  submitted_at: string;
}

export interface DashboardIntelligence {
  wall_of_shame: WallOfShameEntry[];
  hostile_calls: HostileCallAlert[];
  pending_verifications: PendingVerificationAlert[];
}

export async function fetchDashboardIntelligence(
  workspaceMode: WorkspaceMode,
  businessId: string | null
): Promise<DashboardIntelligence> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ workspace_mode: workspaceMode });

  if (workspaceMode === "business" && businessId) {
    params.set("business_id", businessId);
  }

  const response = await fetch(`/api/dashboard/intelligence?${params.toString()}`, {
    headers,
  });

  const body = (await response.json()) as DashboardIntelligence & { error?: string };

  if (!response.ok) {
    throw new Error(body.error || "Failed to load dashboard intelligence.");
  }

  return {
    wall_of_shame: body.wall_of_shame ?? [],
    hostile_calls: body.hostile_calls ?? [],
    pending_verifications: body.pending_verifications ?? [],
  };
}
