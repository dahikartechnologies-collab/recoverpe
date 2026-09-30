import { SupabaseClient } from "@supabase/supabase-js";

export function hasCollectionDetails(input: {
  defaultUpiVpa?: string | null;
  payoutBankAccountNumber?: string | null;
}): boolean {
  return Boolean(
    input.defaultUpiVpa?.trim() || input.payoutBankAccountNumber?.trim()
  );
}

export const COLLECTION_DETAILS_REQUIRED_MESSAGE =
  "Add your UPI ID or bank account in Settings before creating a Khata entry or sending a WhatsApp payment link. The bot needs this to collect money.";

export async function workspaceHasCollectionDetails(
  supabase: SupabaseClient,
  userId: string,
  businessId?: string | null
): Promise<boolean> {
  const { data: userRow } = await supabase
    .from("users")
    .select("default_upi_vpa")
    .eq("id", userId)
    .maybeSingle();

  if ((userRow?.default_upi_vpa as string | null)?.trim()) {
    return true;
  }

  if (!businessId) {
    return false;
  }

  const { data: businessRow } = await supabase
    .from("businesses")
    .select("payout_bank_account_number")
    .eq("id", businessId)
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(
    (businessRow?.payout_bank_account_number as string | null)?.trim()
  );
}
