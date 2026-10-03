import { NextResponse } from "next/server";
import {
  applyLiveUsageCounts,
  buildUsageDashboardPayload,
  EMPTY_LIVE_BUSINESS_USAGE,
  EMPTY_USAGE_TABLE_COUNTS,
  EMPTY_USAGE_WINDOW,
  fetchVapiCallUsageHistory,
  hydrateBusinessUsageFromLiveCounts,
  syncBusinessUsageQuotas,
} from "@/lib/business-usage-metering";
import { parseUsageMonthParam } from "@/lib/billing-period";
import { resolveWorkspaceAuth } from "@/lib/auth-gateway";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authResult = await resolveWorkspaceAuth(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("business_id")?.trim() ?? "";
    const month = parseUsageMonthParam(searchParams.get("month"));

    if (!businessId) {
      return NextResponse.json(
        { error: "business_id is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", businessId)
      .eq("user_id", authResult.effectiveUserId)
      .maybeSingle();

    if (businessError) {
      return NextResponse.json(
        { error: businessError.message || "Failed to verify business." },
        { status: 500 }
      );
    }

    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    let quotaRow;
    try {
      quotaRow = await syncBusinessUsageQuotas(supabase, businessId);
    } catch (quotaError) {
      console.error("[dashboard-usage] Quota sync failed:", quotaError);
      quotaRow = null;
    }

    if (!quotaRow) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    let meteringRow = quotaRow;
    let liveCounts = { ...EMPTY_USAGE_TABLE_COUNTS };
    let usageWindow = { ...EMPTY_USAGE_WINDOW };

    try {
      const hydrated = await hydrateBusinessUsageFromLiveCounts(
        supabase,
        quotaRow,
        { month }
      );
      meteringRow = hydrated.row;
      liveCounts = hydrated.live_counts;
      usageWindow = hydrated.usage_window;
    } catch (countError) {
      console.error("[dashboard-usage] Live count failed:", countError);
      meteringRow = applyLiveUsageCounts(quotaRow, EMPTY_LIVE_BUSINESS_USAGE);
      liveCounts = { ...EMPTY_USAGE_TABLE_COUNTS };
      usageWindow = { ...EMPTY_USAGE_WINDOW };
    }

    let vapiWalletBalance = 0;
    try {
      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("vapi_wallet_balance")
        .eq("id", authResult.effectiveUserId)
        .maybeSingle();

      if (userError) {
        console.error("[dashboard-usage] Wallet load failed:", userError.message);
      } else {
        vapiWalletBalance = Number(userRow?.vapi_wallet_balance ?? 0);
      }
    } catch (walletError) {
      console.error("[dashboard-usage] Wallet load failed:", walletError);
    }

    let vapiCallHistory: Awaited<ReturnType<typeof fetchVapiCallUsageHistory>> =
      [];
    try {
      vapiCallHistory = await fetchVapiCallUsageHistory(supabase, businessId);
    } catch (historyError) {
      console.error("[dashboard-usage] Call history failed:", historyError);
    }

    const payload = buildUsageDashboardPayload(meteringRow, {
      vapi_wallet_balance_inr: vapiWalletBalance,
      vapi_call_history: vapiCallHistory,
      live_counts: liveCounts,
      usage_window: usageWindow,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load usage dashboard.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
