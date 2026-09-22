import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import { requireInboxAccess } from "@/lib/inbox-entitlement";
import { sendOwnerInboxReply } from "@/lib/inbox";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export const POST = withWorkspaceMutation(
  async (request, auth, context) => {
    const params = await context.params;
    const contactId = params?.contactId?.trim();

    if (!contactId) {
      return NextResponse.json({ error: "Contact is required." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as
      | { body?: string }
      | null;
    const text = body?.body?.trim() ?? "";

    if (!text) {
      return NextResponse.json(
        { error: "Message body is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const denied = await requireInboxAccess(
      supabase,
      auth.workspaceBusinessId,
      auth.effectiveUserId
    );

    if (denied) {
      return denied;
    }

    const message = await sendOwnerInboxReply(supabase, {
      workspaceUserId: auth.effectiveUserId,
      businessId: auth.workspaceBusinessId,
      contactId,
      body: text,
    });

    return NextResponse.json({ ok: true, message });
  },
  { permission: "send_reminders" }
);
