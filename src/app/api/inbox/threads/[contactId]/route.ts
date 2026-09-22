import { NextResponse } from "next/server";
import { resolveWorkspaceAuth } from "@/lib/auth-gateway";
import { requireInboxAccess } from "@/lib/inbox-entitlement";
import { listInboxThreadMessages } from "@/lib/inbox";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: { contactId: string } }
) {
  const auth = await resolveWorkspaceAuth(request);

  if ("error" in auth) {
    return auth.error;
  }

  const contactId = context.params.contactId?.trim();

  if (!contactId) {
    return NextResponse.json({ error: "Contact is required." }, { status: 400 });
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
    const messages = await listInboxThreadMessages(
      supabase,
      auth.effectiveUserId,
      businessId,
      contactId
    );

    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load thread.",
      },
      { status: 500 }
    );
  }
}
