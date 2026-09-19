import { NextResponse } from "next/server";
import { requireActiveAgent } from "@/lib/agent/auth";
import { writeAuditLog } from "@/lib/audit-logs";
import { withdrawApprovedAgentPayouts } from "@/lib/payments/payouts";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const agent = await requireActiveAgent(request);

  if ("error" in agent) {
    return agent.error;
  }

  try {
    const supabase = createAdminSupabaseClient();
    const result = await withdrawApprovedAgentPayouts(supabase, agent.agentId);

    await writeAuditLog(supabase, {
      actorId: agent.userId,
      action: "agent.payout.withdrawn",
      resourceType: "agent",
      resourceId: agent.agentId,
      metadata: {
        total_inr: result.totalInr,
        utr_number: result.utrNumber,
        razorpay_payout_id: result.razorpayPayoutId,
        payout_ids: result.payoutIds,
      },
    });

    return NextResponse.json({
      ok: true,
      total_inr: result.totalInr,
      utr_number: result.utrNumber,
      settled_at: result.settledAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to withdraw commissions.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
