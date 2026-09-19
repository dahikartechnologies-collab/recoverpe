import { NextResponse } from "next/server";
import { requireActiveAgent } from "@/lib/agent/auth";
import { updateAgentReferralQuote } from "@/lib/agent/referrals";
import { writeAuditLog } from "@/lib/audit-logs";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function PATCH(
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
      discount_bps?: number;
      business_name?: string | null;
    } | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const referral = await updateAgentReferralQuote(
      supabase,
      agent.agentId,
      id,
      {
        discountBps: body.discount_bps,
        businessName: body.business_name,
      },
      agent.discountCapBps
    );

    await writeAuditLog(supabase, {
      actorId: agent.userId,
      action: "agent.referral.quote_updated",
      resourceType: "agent_referral",
      resourceId: id,
      metadata: {
        discount_bps: body.discount_bps ?? null,
        business_name: body.business_name ?? null,
      },
    });

    return NextResponse.json({ referral });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update referral.";

    const status =
      message === "Referral not found." ||
      message === "Only draft or awaiting OTP referrals can be edited."
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
