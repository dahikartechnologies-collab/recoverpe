import { unstable_cache } from "next/cache";
import { fetchReconciliationActivity } from "@/lib/dashboard-activity-feed";
import { fetchDashboardAnalytics } from "@/lib/dashboard-analytics";
import {
  DASHBOARD_ANALYTICS_TAG,
  DASHBOARD_INTELLIGENCE_TAG,
  dashboardAnalyticsUserTag,
  dashboardIntelligenceUserTag,
} from "@/lib/dashboard-cache";
import { fetchDashboardIntelligence } from "@/lib/dashboard-intelligence";
import {
  DashboardHomePayload,
  EMPTY_DASHBOARD_HOME,
} from "@/lib/dashboard-home-types";
import {
  computeDashboardMetrics,
  fetchLedgersForWorkspace,
  LEDGER_PAGE_SIZE,
} from "@/lib/ledger-queries";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { resolveDataAccessScope } from "@/lib/workspace-data-scope";
import { WorkspaceMode } from "@/types";
import { WorkspaceAuthContext } from "@/lib/auth-gateway";

export type { DashboardHomePayload };
export { EMPTY_DASHBOARD_HOME };

export async function loadDashboardHome(
  auth: WorkspaceAuthContext,
  workspaceMode: WorkspaceMode,
  businessId: string | null
): Promise<DashboardHomePayload> {
  if (workspaceMode === "business" && !businessId) {
    return EMPTY_DASHBOARD_HOME;
  }

  const dataScope = resolveDataAccessScope(auth);
  const assignedScope = dataScope.restrictToAssignedUserId ?? "all";
  const cacheKey = [
    auth.effectiveUserId,
    workspaceMode,
    businessId ?? "none",
    assignedScope,
  ].join(":");
  const supabase = createAdminSupabaseClient();
  const assignedToUserId = dataScope.restrictToAssignedUserId;

  const getCachedAnalytics = unstable_cache(
    async () => {
      const cachedSupabase = createAdminSupabaseClient();
      return fetchDashboardAnalytics(
        cachedSupabase,
        auth.effectiveUserId,
        workspaceMode,
        businessId,
        assignedToUserId
      );
    },
    ["dashboard-analytics", cacheKey],
    {
      tags: [
        DASHBOARD_ANALYTICS_TAG,
        dashboardAnalyticsUserTag(auth.effectiveUserId),
      ],
      revalidate: 30,
    }
  );

  const getCachedIntelligence = unstable_cache(
    async () => {
      const cachedSupabase = createAdminSupabaseClient();
      return fetchDashboardIntelligence(
        cachedSupabase,
        auth.effectiveUserId,
        workspaceMode,
        businessId,
        assignedToUserId
      );
    },
    ["dashboard-intelligence", cacheKey],
    {
      tags: [
        DASHBOARD_INTELLIGENCE_TAG,
        dashboardIntelligenceUserTag(auth.effectiveUserId),
      ],
      revalidate: 30,
    }
  );

  const [analytics, intelligence, activity, ledgerPage] = await Promise.all([
      getCachedAnalytics(),
      getCachedIntelligence(),
      fetchReconciliationActivity(supabase, auth.effectiveUserId, {
        businessId: workspaceMode === "business" ? businessId : null,
        limit: 10,
      }),
      fetchLedgersForWorkspace(
        supabase,
        auth.effectiveUserId,
        workspaceMode,
        businessId,
        {
          limit: LEDGER_PAGE_SIZE,
          offset: 0,
          assignedToUserId: dataScope.restrictToAssignedUserId,
        }
      ),
    ]);

  const metrics = await computeDashboardMetrics(
    supabase,
    auth.effectiveUserId,
    workspaceMode,
    businessId,
    ledgerPage.ledgers,
    { forceFallback: Boolean(dataScope.restrictToAssignedUserId) }
  );

  const hasMore =
    ledgerPage.offset + ledgerPage.ledgers.length < ledgerPage.total;

  return {
    analytics,
    intelligence,
    activity,
    ledgers: ledgerPage.ledgers,
    metrics,
    pagination: {
      total: ledgerPage.total,
      limit: ledgerPage.limit,
      offset: ledgerPage.offset,
      page: Math.floor(ledgerPage.offset / ledgerPage.limit) + 1,
      hasMore,
    },
  };
}
