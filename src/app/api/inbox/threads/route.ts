import { NextResponse } from "next/server";
import { resolveWorkspaceAuth } from "@/lib/auth-gateway";
import { requireInboxAccess } from "@/lib/inbox-entitlement";
import { listInboxThreads } from "@/lib/inbox";
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

  const supabase = createAdminSupabaseClient();
  const denied = await requireInboxAccess(
    supabase,
    businessId,
    auth.effectiveUserId
  );

  if (denied) {
    return denied;
  }

  try {
    const threads = await listInboxThreads(
      supabase,
      auth.effectiveUserId,
      businessId
    );

    return NextResponse.json({ threads });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load inbox.",
      },
      { status: 500 }
    );
  }
}
