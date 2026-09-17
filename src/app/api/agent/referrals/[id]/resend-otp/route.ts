import { NextResponse } from "next/server";
import { requireActiveAgent } from "@/lib/agent/auth";
import { AGENT_OTP_TTL_MS } from "@/lib/agent/constants";
import {
  generateAgentOtpCode,
  hashAgentOtp,
} from "@/lib/agent/otp";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const agent = await requireActiveAgent(request);

  if ("error" in agent) {
    return agent.error;
  }

  const { id } = await context.params;
  const supabase = createAdminSupabaseClient();

  const { data: referral, error } = await supabase
    .from("agent_referrals")
    .select("id, merchant_phone, status")
    .eq("id", id)
    .eq("agent_id", agent.agentId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load referral." },
      { status: 500 }
    );
  }

  if (!referral) {
    return NextResponse.json({ error: "Referral not found." }, { status: 404 });
  }

  if (referral.status !== "awaiting_merchant_otp") {
    return NextResponse.json(
      { error: "OTP can only be resent while awaiting merchant confirmation." },
      { status: 400 }
    );
  }

  const otp = generateAgentOtpCode();
  const expiresAt = new Date(Date.now() + AGENT_OTP_TTL_MS).toISOString();

  const { error: updateError } = await supabase
    .from("agent_referrals")
    .update({
      merchant_otp_hash: hashAgentOtp(otp),
      merchant_otp_expires_at: expiresAt,
      merchant_otp_attempts: 0,
    })
    .eq("id", id)
    .eq("agent_id", agent.agentId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || "Failed to refresh merchant OTP." },
      { status: 500 }
    );
  }

  const sent = await sendWhatsAppTextMessage(
    referral.merchant_phone as string,
    [
      "RecoverPe Premium confirmation.",
      `Reply with this 6-digit code to activate: ${otp}`,
      "This code expires in 10 minutes. Your RecoverPe agent cannot activate you.",
    ].join("\n")
  );

  return NextResponse.json({
    referral_id: referral.id,
    status: "awaiting_merchant_otp",
    otp_sent: sent,
  });
}
