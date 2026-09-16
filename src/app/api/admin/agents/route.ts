import { NextResponse } from "next/server";
import { createAgentByPhone, listAdminAgents } from "@/lib/admin-agents";
import { requireSuperAdminUser } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const authResult = await requireSuperAdminUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const supabase = createAdminSupabaseClient();
    const agents = await listAdminAgents(supabase);

    return NextResponse.json({ agents });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load agents.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireSuperAdminUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const body = (await request.json()) as {
      phone_number?: string;
      display_name?: string;
      discount_cap_bps?: number;
    };

    const phoneNumber = body.phone_number?.trim();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: "phone_number is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const result = await createAgentByPhone(supabase, phoneNumber, {
      displayName: body.display_name,
      discountCapBps: body.discount_cap_bps,
    });

    return NextResponse.json({
      success: true,
      message: `Agent row created for ${result.user.phone_number}.`,
      user: result.user,
      agent: result.agent,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create agent.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
