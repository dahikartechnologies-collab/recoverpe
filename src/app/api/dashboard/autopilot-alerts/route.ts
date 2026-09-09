import { NextResponse } from "next/server";
import { resolveWorkspaceAuth } from "@/lib/auth-gateway";
import { fetchAutopilotEscalationAlerts } from "@/lib/autopilot-alerts";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { WorkspaceMode } from "@/types";

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
      return NextResponse.json({ alerts: [] });
    }

    const supabase = createAdminSupabaseClient();
    const alerts = await fetchAutopilotEscalationAlerts(
      supabase,
      authResult.effectiveUserId,
      workspaceMode === "business" ? businessId : null
    );

    return NextResponse.json({ alerts });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load autopilot escalation alerts.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
