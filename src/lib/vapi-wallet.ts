import { SupabaseClient } from "@supabase/supabase-js";

export async function reserveVapiCredits(
  supabase: SupabaseClient,
  userId: string,
  amount: number
): Promise<number | null> {
  const { data, error } = await supabase.rpc("reserve_vapi_credits", {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    throw new Error(error.message || "Failed to reserve VAPI credits.");
  }

  if (data === null || data === undefined) {
    return null;
  }

  return Number(data);
}

export async function refundVapiCredits(
  supabase: SupabaseClient,
  userId: string,
  amount: number
): Promise<number | null> {
  const { data, error } = await supabase.rpc("refund_vapi_credits", {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    throw new Error(error.message || "Failed to refund VAPI credits.");
  }

  if (data === null || data === undefined) {
    return null;
  }

  return Number(data);
}
