import { NextResponse } from "next/server";
import {
  buildUsageDashboardPayload,
  syncBusinessUsageQuotas,
} from "@/lib/business-usage-metering";
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

    const row = await syncBusinessUsageQuotas(supabase, businessId);

    if (!row) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    return NextResponse.json(buildUsageDashboardPayload(row), {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load usage dashboard.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
