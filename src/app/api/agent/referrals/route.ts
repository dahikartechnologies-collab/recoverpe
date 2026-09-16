import { NextResponse } from "next/server";
import { requireActiveAgent } from "@/lib/agent/auth";
import {
  AGENT_OTP_TTL_MS,
  AGENT_MAX_DISCOUNT_BPS,
} from "@/lib/agent/constants";
import {
  countOpenCashTickets,
  isAgentReferralFrozen,
} from "@/lib/agent/cash-protocol";
import {
  generateAgentOtpCode,
  hashAgentOtp,
  normalizeMerchantPhone,
} from "@/lib/agent/otp";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const agent = await requireActiveAgent(request);

  if ("error" in agent) {
    return agent.error;
  }

  if (agent.status !== "active") {
    return NextResponse.json(
      { error: "Agent KYC must be active before referring merchants." },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    merchant_phone?: string;
    business_name?: string;
    discount_bps?: number;
  } | null;

  const merchantPhone = normalizeMerchantPhone(body?.merchant_phone ?? "");
  const last10 = merchantPhone.replace(/\D/g, "").slice(-10);

  if (last10.length !== 10) {
    return NextResponse.json(
      { error: "Merchant phone must be a 10-digit Indian mobile number." },
      { status: 400 }
    );
  }

  const discountBps = Math.max(0, Math.round(Number(body?.discount_bps ?? 0)));

  if (discountBps > agent.discountCapBps || discountBps > AGENT_MAX_DISCOUNT_BPS) {
    return NextResponse.json(
      { error: "Discount exceeds this agent's cap." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabaseClient();
  const openCashTickets = await countOpenCashTickets(supabase, agent.agentId);

  if (
    isAgentReferralFrozen({
      walletLiabilityInr: agent.walletLiabilityInr,
      openCashTickets,
    })
  ) {
    return NextResponse.json(
      {
        error:
          "New referrals are frozen until unremitted cash is below five tickets.",
      },
      { status: 403 }
    );
  }

  const otp = generateAgentOtpCode();
  const expiresAt = new Date(Date.now() + AGENT_OTP_TTL_MS).toISOString();

  const { data: referral, error } = await supabase
    .from("agent_referrals")
    .insert({
      agent_id: agent.agentId,
      merchant_phone: merchantPhone,
      business_name: body?.business_name?.trim() || null,
      discount_bps: discountBps,
      status: "awaiting_merchant_otp",
      merchant_otp_hash: hashAgentOtp(otp),
      merchant_otp_expires_at: expiresAt,
      merchant_otp_attempts: 0,
    })
    .select("id")
    .single();

  if (error || !referral) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "An open referral already exists for this merchant phone." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error?.message || "Failed to create referral." },
      { status: 500 }
    );
  }

  const sent = await sendWhatsAppTextMessage(
    merchantPhone,
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
