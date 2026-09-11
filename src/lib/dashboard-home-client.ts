import { getAuthHeaders } from "@/lib/auth-headers";
import {
  coalesceDashboardRequest,
  invalidateDashboardCache,
} from "@/lib/dashboard-request-cache";
import {
  DashboardHomePayload,
  EMPTY_DASHBOARD_HOME,
} from "@/lib/dashboard-home-types";
import { WorkspaceMode } from "@/types";

const HOME_TTL_MS = 20_000;
const HOME_CACHE_PREFIX = "dashboard-home:";

export type { DashboardHomePayload };

export function dashboardHomeCacheKey(
  workspaceMode: WorkspaceMode,
  businessId: string | null
): string {
  return `${HOME_CACHE_PREFIX}${workspaceMode}:${businessId ?? "none"}`;
}

export function invalidateDashboardHomeCache(): void {
  invalidateDashboardCache(HOME_CACHE_PREFIX);
}

export async function fetchDashboardHome(
  workspaceMode: WorkspaceMode,
  businessId: string | null
): Promise<DashboardHomePayload> {
  if (workspaceMode === "business" && !businessId) {
    return EMPTY_DASHBOARD_HOME;
  }

  return coalesceDashboardRequest(
    dashboardHomeCacheKey(workspaceMode, businessId),
    HOME_TTL_MS,
    async () => {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({ workspace_mode: workspaceMode });

      if (workspaceMode === "business" && businessId) {
        params.set("business_id", businessId);
      }

      const response = await fetch(`/api/dashboard/home?${params.toString()}`, {
        headers,
      });
      const body = (await response.json()) as DashboardHomePayload & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error || "Failed to load dashboard home.");
      }

      return {
        ...EMPTY_DASHBOARD_HOME,
        ...body,
        analytics: body.analytics ?? EMPTY_DASHBOARD_HOME.analytics,
        intelligence: body.intelligence ?? EMPTY_DASHBOARD_HOME.intelligence,
        activity: body.activity ?? [],
        ledgers: body.ledgers ?? [],
        metrics: body.metrics ?? EMPTY_DASHBOARD_HOME.metrics,
        pagination: body.pagination ?? EMPTY_DASHBOARD_HOME.pagination,
      };
    }
  );
}
