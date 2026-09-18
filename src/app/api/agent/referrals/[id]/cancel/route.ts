import { NextResponse } from "next/server";
import { requireActiveAgent } from "@/lib/agent/auth";
import { cancelAgentReferral } from "@/lib/agent/referrals";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const agent = await requireActiveAgent(request);

  if ("error" in agent) {
    return agent.error;
  }

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      reason?: string;
    } | null;

    if (!body?.reason?.trim()) {
      return NextResponse.json(
        { error: "A cancellation reason is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const referral = await cancelAgentReferral(
      supabase,
      agent.agentId,
      id,
      body.reason
    );

    return NextResponse.json({ referral });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to cancel referral.";

    const status =
      message === "Referral not found." ||
      message.includes("cannot be cancelled") ||
      message === "A cancellation reason is required."
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
