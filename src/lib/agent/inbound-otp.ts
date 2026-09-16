import { SupabaseClient } from "@supabase/supabase-js";
import { activateReferralAtMerchantOtp } from "@/lib/agent/cash-protocol";
import { AGENT_OTP_MAX_ATTEMPTS } from "@/lib/agent/constants";
import { agentOtpMatches, extractSixDigitOtp } from "@/lib/agent/otp";
import { buildPhoneLookupCandidates } from "@/lib/whatsapp/inbound-payment-responder";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";

export async function tryConsumeMerchantOtpFromInbound(
  supabase: SupabaseClient,
  rawFrom: string,
  messageText: string
): Promise<boolean> {
  const otp = extractSixDigitOtp(messageText);

  if (!otp) {
    return false;
  }

  const phones = buildPhoneLookupCandidates(rawFrom);
  const { data: referrals, error } = await supabase
    .from("agent_referrals")
    .select(
      "id, agent_id, merchant_user_id, merchant_phone, discount_bps, status, merchant_otp_hash, merchant_otp_expires_at, merchant_otp_attempts"
    )
    .in("merchant_phone", phones)
    .eq("status", "awaiting_merchant_otp")
    .limit(5);

  if (error || !referrals?.length) {
    return false;
  }

  const now = Date.now();

  for (const referral of referrals) {
    const expiresAt = referral.merchant_otp_expires_at
      ? new Date(referral.merchant_otp_expires_at as string).getTime()
      : 0;

    if (!expiresAt || expiresAt < now) {
      await supabase
        .from("agent_referrals")
        .update({ status: "cancelled", merchant_otp_hash: null })
        .eq("id", referral.id)
        .eq("status", "awaiting_merchant_otp");
      continue;
    }

    const attempts = Number(referral.merchant_otp_attempts ?? 0);

    if (attempts >= AGENT_OTP_MAX_ATTEMPTS) {
      await supabase
        .from("agent_referrals")
        .update({ status: "cancelled", merchant_otp_hash: null })
        .eq("id", referral.id);
      continue;
    }

    const storedHash = String(referral.merchant_otp_hash ?? "");

    if (!storedHash || !agentOtpMatches(otp, storedHash)) {
      await supabase
        .from("agent_referrals")
        .update({ merchant_otp_attempts: attempts + 1 })
        .eq("id", referral.id);
      continue;
    }

    const { data: merchant } = await supabase
      .from("users")
      .select("id")
      .in("phone_number", phones)
      .limit(1)
      .maybeSingle();

    await activateReferralAtMerchantOtp(
      supabase,
      {
        id: referral.id as string,
        agent_id: referral.agent_id as string,
        merchant_user_id: (merchant?.id as string | undefined) ?? null,
        merchant_phone: referral.merchant_phone as string,
        discount_bps: Number(referral.discount_bps ?? 0),
        status: referral.status as string,
      },
      (merchant?.id as string | undefined) ?? null
    );

    await sendWhatsAppTextMessage(
      rawFrom,
      "Premium is now active on RecoverPe. Thank you. Your agent cannot change this from their phone."
    );

    return true;
  }

  return false;
}
