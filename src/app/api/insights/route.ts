import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { resolveWorkspaceAuth } from "@/lib/auth-gateway";
import {
  buildBusinessPulse,
  buildFallbackNarrative,
  buildInsightsPrompt,
  parseInsightNarrative,
  type BusinessPulse,
  type InsightNarrative,
} from "@/lib/business-pulse";
import { fetchDashboardAnalytics } from "@/lib/dashboard-analytics";
import {
  DASHBOARD_ANALYTICS_TAG,
  dashboardAnalyticsUserTag,
} from "@/lib/dashboard-cache";
import {
  getDefaultGeminiModel,
  getVertexAI,
} from "@/lib/firebase-admin-vertexai";
import { captureHandledError } from "@/lib/observability";
import { retryAsync } from "@/lib/resilient-fetch";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { getTodayDateStringInIst } from "@/lib/timezone";
import { WorkspaceMode } from "@/types";
import { resolveDataAccessScope } from "@/lib/workspace-data-scope";
import { isPremiumBusiness } from "@/lib/workspace-rbac";

export const dynamic = "force-dynamic";

async function generatePremiumNarrative(
  pulse: BusinessPulse
): Promise<InsightNarrative> {
  if (isDevelopmentAppEnv()) {
    return buildFallbackNarrative(pulse);
  }

  try {
    const modelId = getDefaultGeminiModel();
    const result = await retryAsync(
      () =>
        getVertexAI()
          .getGenerativeModel({ model: modelId })
          .generateContent(buildInsightsPrompt(pulse), {
            responseMimeType: "application/json",
            temperature: 0.2,
          }),
      { scope: "VERTEX INSIGHTS", maxAttempts: 2, baseDelayMs: 400 }
    );

    return (
      parseInsightNarrative(result.response.text()) ??
      buildFallbackNarrative(pulse)
    );
  } catch (error) {
    captureHandledError("insights.vertex", error);
    return buildFallbackNarrative(pulse);
  }
}

async function loadExpensePulse(
  userId: string,
  businessId: string | null
): Promise<{
  spentThisMonth: number;
  topExpenseCategory: string | null;
  topExpenseCategoryAmount: number;
}> {
  const supabase = createAdminSupabaseClient();
  const monthStart = `${getTodayDateStringInIst().slice(0, 7)}-01`;

  let query = supabase
    .from("expenses")
    .select("amount, category, expense_date")
    .eq("user_id", userId)
    .gte("expense_date", monthStart)
    .limit(500);

  query = businessId
    ? query.eq("business_id", businessId)
    : query.is("business_id", null);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to load expenses for insights.");
  }

  const totals = new Map<string, number>();
  let spentThisMonth = 0;

  for (const row of data ?? []) {
    const amount = Number(row.amount) || 0;
    spentThisMonth += amount;
    const category = String(row.category ?? "");
    totals.set(category, (totals.get(category) ?? 0) + amount);
  }

  let topCategory: string | null = null;
  let topAmount = 0;

  for (const [category, amount] of Array.from(totals.entries())) {
    if (amount > topAmount) {
      topCategory = category;
      topAmount = amount;
    }
  }

  const label = topCategory ? topCategory.replace(/_/g, " ") : null;

  return {
    spentThisMonth,
    topExpenseCategory: label,
    topExpenseCategoryAmount: topAmount,
  };
}

export async function GET(request: Request) {
  const authResult = await resolveWorkspaceAuth(request);

  if ("error" in authResult) {
    return authResult.error;
  }

  try {
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
      return NextResponse.json({
        is_premium: false,
        pulse: buildBusinessPulse({
          collectedThisMonth: 0,
          totalOutstanding: 0,
          activeDefaulters: 0,
          collectionRate: 0,
          aging61Plus: 0,
          spentThisMonth: 0,
          topExpenseCategory: null,
          topExpenseCategoryAmount: 0,
        }),
        narrative: null,
      });
    }

    const dataScope = resolveDataAccessScope(authResult);
    const assignedScope = dataScope.restrictToAssignedUserId ?? "all";
    const analyticsCacheKey = [
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
      ["dashboard-analytics", analyticsCacheKey],
      {
        tags: [
          DASHBOARD_ANALYTICS_TAG,
          dashboardAnalyticsUserTag(authResult.effectiveUserId),
        ],
        revalidate: 30,
      }
    );

    const supabase = createAdminSupabaseClient();

    const [analytics, expensePulse, userRow, businessRow] = await Promise.all([
      getCachedAnalytics(),
      loadExpensePulse(authResult.effectiveUserId, businessId),
      supabase
        .from("users")
        .select("subscription_plan")
        .eq("id", authResult.effectiveUserId)
        .maybeSingle()
        .then((result) => result.data),
      businessId
        ? supabase
            .from("businesses")
            .select("subscription_tier")
            .eq("id", businessId)
            .eq("user_id", authResult.effectiveUserId)
            .maybeSingle()
            .then((result) => result.data)
        : Promise.resolve(null),
    ]);

    const aging61Plus =
      analytics.aging.find((segment) => segment.key === "61+")?.amount ?? 0;

    const pulse = buildBusinessPulse({
      collectedThisMonth: analytics.summary.collectedThisMonth,
      totalOutstanding: analytics.summary.totalOutstanding,
      activeDefaulters: analytics.summary.activeDefaulters,
      collectionRate: analytics.summary.collectionRate,
      aging61Plus,
      spentThisMonth: expensePulse.spentThisMonth,
      topExpenseCategory: expensePulse.topExpenseCategory,
      topExpenseCategoryAmount: expensePulse.topExpenseCategoryAmount,
    });

    const isPremium =
      workspaceMode === "business"
        ? isPremiumBusiness(
            businessRow
              ? {
                  subscription_tier:
                    businessRow.subscription_tier === "premium"
                      ? "premium"
                      : "free",
                }
              : null
          )
        : userRow?.subscription_plan === "premium";

    if (!isPremium) {
      return NextResponse.json({
        is_premium: false,
        pulse,
        narrative: null,
      });
    }

    const dayKey = getTodayDateStringInIst();
    const cacheKey = [
      "business-insights",
      authResult.effectiveUserId,
      workspaceMode,
      businessId ?? "personal",
      dayKey,
      pulse.headline,
      String(pulse.netCashflow),
    ].join(":");

    const getCachedNarrative = unstable_cache(
      async () => generatePremiumNarrative(pulse),
      [cacheKey],
      { revalidate: 60 * 60 * 6 }
    );

    const narrative = await getCachedNarrative();

    return NextResponse.json({
      is_premium: true,
      pulse,
      narrative,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load insights.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
