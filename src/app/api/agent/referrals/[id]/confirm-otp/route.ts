import { NextResponse } from "next/server";
import { requireActiveAgent } from "@/lib/agent/auth";
import {
  AgentReferralOtpError,
  confirmReferralOtpByAgent,
} from "@/lib/agent/cash-protocol";
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
      otp?: string;
    } | null;

    const otp = body?.otp?.trim() ?? "";

    if (!otp) {
      return NextResponse.json({ error: "OTP is required." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const result = await confirmReferralOtpByAgent(
      supabase,
      agent.agentId,
      id,
      otp
    );

    return NextResponse.json({
      success: true,
      referral_id: id,
      status: result.status,
      expected_inr: result.expected_inr,
      message: "Cash ticket opened. Remit the collected amount to RecoverPe HQ.",
    });
  } catch (error) {
    if (error instanceof AgentReferralOtpError) {
      const status =
        error.code === "invalid_state" || error.code === "not_found"
          ? 404
          : 400;

      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    const message =
      error instanceof Error ? error.message : "Failed to confirm merchant OTP.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
