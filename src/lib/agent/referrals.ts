import { SupabaseClient } from "@supabase/supabase-js";
import { isAllowedAgentDiscountBps } from "@/lib/agent/discounts";

const EDITABLE_REFERRAL_STATUSES = new Set(["draft", "awaiting_merchant_otp"]);

export interface AgentReferralRow {
  id: string;
  merchant_phone: string;
  business_name: string | null;
  discount_bps: number;
  status: string;
  activated_at: string | null;
  created_at: string;
}

export async function updateAgentReferralQuote(
  supabase: SupabaseClient,
  agentId: string,
  referralId: string,
  input: {
    discountBps?: number;
    businessName?: string | null;
  },
  discountCapBps: number
): Promise<AgentReferralRow> {
  const { data: existing, error: existingError } = await supabase
    .from("agent_referrals")
    .select("id, status, discount_bps, business_name")
    .eq("id", referralId)
    .eq("agent_id", agentId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || "Failed to load referral.");
  }

  if (!existing) {
    throw new Error("Referral not found.");
  }

  if (!EDITABLE_REFERRAL_STATUSES.has(existing.status as string)) {
    throw new Error("Only draft or awaiting OTP referrals can be edited.");
  }

  const patch: Record<string, unknown> = {};

  if (input.discountBps !== undefined) {
    if (!isAllowedAgentDiscountBps(input.discountBps, discountCapBps)) {
      throw new Error("Choose a valid discount percentage within your cap.");
    }

    patch.discount_bps = input.discountBps;
  }

  if (input.businessName !== undefined) {
    patch.business_name = input.businessName?.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("No referral changes were provided.");
  }

  const { data, error } = await supabase
    .from("agent_referrals")
    .update(patch)
    .eq("id", referralId)
    .eq("agent_id", agentId)
    .select(
      "id, merchant_phone, business_name, discount_bps, status, activated_at, created_at"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update referral.");
  }

  return data as AgentReferralRow;
}
