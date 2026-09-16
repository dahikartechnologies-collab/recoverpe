import { NextResponse } from "next/server";
import { createAgentForUser } from "@/lib/admin-agents";
import { requireSuperAdminUser } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const authResult = await requireSuperAdminUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const body = (await request.json()) as {
      display_name?: string;
      discount_cap_bps?: number;
    };

    const supabase = createAdminSupabaseClient();
    const agent = await createAgentForUser(supabase, authResult.userId, {
      displayName: body.display_name,
      discountCapBps: body.discount_cap_bps,
    });

    return NextResponse.json({
      success: true,
      message: "You are now an active Field Agent. Visit /choose-context to switch surfaces.",
      agent,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to assign agent row.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
