import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import { setContactBotPaused } from "@/lib/inbox";
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
      | { paused?: boolean }
      | null;

    await setContactBotPaused(
      createAdminSupabaseClient(),
      auth.effectiveUserId,
      contactId,
      body?.paused !== false
    );

    return NextResponse.json({ bot_paused: body?.paused !== false });
  },
  { permission: "send_reminders" }
);
