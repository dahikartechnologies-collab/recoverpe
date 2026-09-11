import { NextResponse } from "next/server";
import { resolveWorkspaceAuth } from "@/lib/auth-gateway";
import { EMPTY_DASHBOARD_HOME, loadDashboardHome } from "@/lib/dashboard-home";
import { WorkspaceMode } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authResult = await resolveWorkspaceAuth(request);

    if ("error" in authResult) {
      return authResult.error;
    }

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
      return NextResponse.json(EMPTY_DASHBOARD_HOME);
    }

    const payload = await loadDashboardHome(
      authResult,
      workspaceMode,
      businessId
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard home.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
