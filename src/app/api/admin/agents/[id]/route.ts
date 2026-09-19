import { NextResponse } from "next/server";
import { updateAdminAgent } from "@/lib/admin-agents";
import { requireSuperAdminUser } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

interface RouteContext {
  params: { id: string };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authResult = await requireSuperAdminUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const agentId = context.params.id?.trim();

    if (!agentId) {
      return NextResponse.json({ error: "Agent id is required." }, { status: 400 });
    }

    const body = (await request.json()) as {
      display_name?: string;
      phone_number?: string;
      discount_cap_bps?: number;
      status?: "active" | "suspended";
      revoke?: boolean;
    };

    const supabase = createAdminSupabaseClient();
    const agent = await updateAdminAgent(supabase, agentId, {
      displayName: body.display_name,
      phoneNumber: body.phone_number,
      discountCapBps: body.discount_cap_bps,
      status: body.status,
      revoke: body.revoke,
    });

    return NextResponse.json({
      success: true,
      message: body.revoke
        ? "Agent access revoked."
        : "Agent profile updated.",
      agent,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update agent.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
