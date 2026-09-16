import { NextResponse } from "next/server";
import { resolveWorkspaceAuth } from "@/lib/auth-gateway";
import { fetchLatestBriefing } from "@/lib/briefing";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await resolveWorkspaceAuth(request);

  if ("error" in auth) {
    return auth.error;
  }

  const businessId =
    new URL(request.url).searchParams.get("business_id")?.trim() ||
    auth.workspaceBusinessId;

  const briefing = await fetchLatestBriefing(
    createAdminSupabaseClient(),
    auth.effectiveUserId,
    businessId
  );

  return NextResponse.json({ briefing });
}
