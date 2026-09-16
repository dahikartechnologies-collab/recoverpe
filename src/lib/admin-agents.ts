import { SupabaseClient } from "@supabase/supabase-js";
import {
  AGENT_DEFAULT_DISCOUNT_CAP_BPS,
  AGENT_MAX_DISCOUNT_BPS,
} from "@/lib/agent/constants";
import { generateReferralCode } from "@/lib/agent/otp";
import { buildPhoneLookupCandidates } from "@/lib/whatsapp/inbound-payment-responder";

export interface AdminAgentRow {
  id: string;
  user_id: string;
  display_name: string;
  status: string;
  referral_code: string;
  discount_cap_bps: number;
  created_at: string;
  user_email?: string;
  user_phone?: string;
}

interface UserLookupRow {
  id: string;
  email: string;
  phone_number: string;
}

export async function lookupUserByPhone(
  supabase: SupabaseClient,
  rawPhone: string
): Promise<UserLookupRow | null> {
  const candidates = buildPhoneLookupCandidates(rawPhone);

  const { data, error } = await supabase
    .from("users")
    .select("id, email, phone_number")
    .in("phone_number", candidates)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to lookup user by phone.");
  }

  return (data as UserLookupRow | null) ?? null;
}

function normalizeDiscountCapBps(value: number | undefined): number {
  const cap = value ?? AGENT_DEFAULT_DISCOUNT_CAP_BPS;
  return Math.min(AGENT_MAX_DISCOUNT_BPS, Math.max(0, Math.round(cap)));
}

function defaultDisplayName(user: UserLookupRow): string {
  const emailPrefix = user.email.split("@")[0]?.trim();
  return emailPrefix || user.phone_number;
}

async function insertAgentWithUniqueReferralCode(
  supabase: SupabaseClient,
  input: {
    userId: string;
    displayName: string;
    discountCapBps: number;
  }
): Promise<AdminAgentRow> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const referralCode = generateReferralCode();

    const { data, error } = await supabase
      .from("agents")
      .insert({
        user_id: input.userId,
        display_name: input.displayName,
        status: "active",
        referral_code: referralCode,
        discount_cap_bps: input.discountCapBps,
      })
      .select("id, user_id, display_name, status, referral_code, discount_cap_bps, created_at")
      .single();

    if (!error && data) {
      return data as AdminAgentRow;
    }

    if (error?.code !== "23505") {
      throw new Error(error?.message || "Failed to create agent row.");
    }
  }

  throw new Error("Could not allocate a unique referral code.");
}

export async function createAgentForUser(
  supabase: SupabaseClient,
  userId: string,
  options: {
    displayName?: string;
    discountCapBps?: number;
  } = {}
): Promise<AdminAgentRow> {
  const { data: existing, error: existingError } = await supabase
    .from("agents")
    .select("id, user_id, display_name, status, referral_code, discount_cap_bps, created_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || "Failed to check existing agent.");
  }

  if (existing) {
    if (existing.status !== "active") {
      const { data: reactivated, error: reactivateError } = await supabase
        .from("agents")
        .update({ status: "active" })
        .eq("id", existing.id)
        .select("id, user_id, display_name, status, referral_code, discount_cap_bps, created_at")
        .single();

      if (reactivateError || !reactivated) {
        throw new Error(reactivateError?.message || "Failed to reactivate agent.");
      }

      return reactivated as AdminAgentRow;
    }

    return existing as AdminAgentRow;
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, email, phone_number")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    throw new Error("User not found.");
  }

  return insertAgentWithUniqueReferralCode(supabase, {
    userId,
    displayName: options.displayName?.trim() || defaultDisplayName(user as UserLookupRow),
    discountCapBps: normalizeDiscountCapBps(options.discountCapBps),
  });
}

export async function createAgentByPhone(
  supabase: SupabaseClient,
  rawPhone: string,
  options: {
    displayName?: string;
    discountCapBps?: number;
  } = {}
): Promise<{ user: UserLookupRow; agent: AdminAgentRow }> {
  const user = await lookupUserByPhone(supabase, rawPhone);

  if (!user) {
    throw new Error("No RecoverPe user found for that phone number.");
  }

  const agent = await createAgentForUser(supabase, user.id, options);

  return {
    user,
    agent: {
      ...agent,
      user_email: user.email,
      user_phone: user.phone_number,
    },
  };
}

export async function listAdminAgents(
  supabase: SupabaseClient,
  limit = 50
): Promise<AdminAgentRow[]> {
  const { data, error } = await supabase
    .from("agents")
    .select(
      "id, user_id, display_name, status, referral_code, discount_cap_bps, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to list agents.");
  }

  const agents = (data ?? []) as AdminAgentRow[];
  const userIds = Array.from(new Set(agents.map((agent) => agent.user_id)));

  if (userIds.length === 0) {
    return agents;
  }

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, email, phone_number")
    .in("id", userIds);

  if (usersError) {
    return agents;
  }

  const userById = new Map(
    (users ?? []).map((user) => [user.id as string, user as UserLookupRow])
  );

  return agents.map((agent) => {
    const user = userById.get(agent.user_id);

    return {
      ...agent,
      user_email: user?.email,
      user_phone: user?.phone_number,
    };
  });
}
