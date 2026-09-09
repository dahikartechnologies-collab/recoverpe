import { NextResponse } from "next/server";
import { resolveWorkspaceAuth } from "@/lib/auth-gateway";
import { fetchDashboardIntelligence } from "@/lib/dashboard-intelligence";
import { resolveDataAccessScope } from "@/lib/workspace-data-scope";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { WorkspaceMode } from "@/types";

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
      return NextResponse.json({
        wall_of_shame: [],
        hostile_calls: [],
        pending_verifications: [],
      });
    }

    const supabase = createAdminSupabaseClient();
    const intelligence = await fetchDashboardIntelligence(
      supabase,
      authResult.effectiveUserId,
      workspaceMode,
      businessId,
      dataScope.restrictToAssignedUserId
    );

    return NextResponse.json(intelligence);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard intelligence.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
