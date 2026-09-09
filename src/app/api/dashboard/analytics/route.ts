import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { buildDsoCohortHeatmap } from "@/lib/analytics-dso";
import { buildSankeyFlowFromLedgers } from "@/lib/analytics-sankey";
import { resolveWorkspaceAuth } from "@/lib/auth-gateway";
import {
  DASHBOARD_ANALYTICS_TAG,
  dashboardAnalyticsUserTag,
} from "@/lib/dashboard-cache";
import { fetchDashboardAnalytics } from "@/lib/dashboard-analytics";
import { resolveDataAccessScope } from "@/lib/workspace-data-scope";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { WorkspaceMode } from "@/types";

const EMPTY_ANALYTICS_RESPONSE = {
  summary: {
    totalOutstanding: 0,
    collectedThisMonth: 0,
    activeDefaulters: 0,
    collectionRate: 0,
    collectedThisMonthChangePercent: null,
    collectionRateChangePercent: null,
    totalOutstandingChangePercent: null,
    activeDefaultersChangePercent: null,
  },
  cashFlow: [],
  aging: [
    { key: "0-30", label: "0–30 days", amount: 0 },
    { key: "31-60", label: "31–60 days", amount: 0 },
    { key: "61+", label: "61+ days", amount: 0 },
  ],
  sankey: buildSankeyFlowFromLedgers([]),
  dsoCohort: buildDsoCohortHeatmap([], []),
};

export async function GET(request: Request) {
  try {
    const authResult = await resolveWorkspaceAuth(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const dataScope = resolveDataAccessScope(authResult);
    const { searchParams } = new URL(request.url);
    const workspaceMode = searchParams.get("workspace_mode") as WorkspaceMode | null;
    const businessId = searchParams.get("business_id");

    if (workspaceMode !== "personal" && workspaceMode !== "business") {
      return NextResponse.json(
        { error: "workspace_mode must be personal or business." },
        { status: 400 }
      );
    }

    if (workspaceMode === "business" && !businessId) {
      return NextResponse.json(EMPTY_ANALYTICS_RESPONSE);
    }

    const assignedScope = dataScope.restrictToAssignedUserId ?? "all";
    const cacheKey = [
      authResult.effectiveUserId,
      workspaceMode,
      businessId ?? "none",
      assignedScope,
    ].join(":");

    const getCachedAnalytics = unstable_cache(
      async () => {
        const supabase = createAdminSupabaseClient();

        return fetchDashboardAnalytics(
          supabase,
          authResult.effectiveUserId,
          workspaceMode,
          businessId,
          dataScope.restrictToAssignedUserId
        );
      },
      ["dashboard-analytics", cacheKey],
      {
        tags: [
          DASHBOARD_ANALYTICS_TAG,
          dashboardAnalyticsUserTag(authResult.effectiveUserId),
        ],
        revalidate: 30,
      }
    );

    const analytics = await getCachedAnalytics();

    return NextResponse.json(analytics);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard analytics.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
