import { VirtualAccount } from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";

type RawVirtualAccountRow = {
  id: string;
  user_id: string;
  business_id: string;
  contact_id: string;
  provider: "razorpay" | "cashfree";
  virtual_upi_id: string | null;
  virtual_account_number: string | null;
  ifsc_code: string | null;
  provider_reference_id: string | null;
  status: "active" | "suspended" | "closed";
  created_at: string;
  updated_at: string;
};

function mapVirtualAccount(row: RawVirtualAccountRow): VirtualAccount {
  return {
    id: row.id,
    user_id: row.user_id,
    business_id: row.business_id,
    contact_id: row.contact_id,
    provider: row.provider,
    virtual_upi_id: row.virtual_upi_id,
    virtual_account_number: row.virtual_account_number,
    ifsc_code: row.ifsc_code,
    provider_reference_id: row.provider_reference_id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchVirtualAccountForContact(
  supabase: SupabaseClient,
  userId: string,
  contactId: string,
  businessId?: string | null
): Promise<VirtualAccount | null> {
  let query = supabase
    .from("virtual_accounts")
    .select(
      "id, user_id, business_id, contact_id, provider, virtual_upi_id, virtual_account_number, ifsc_code, provider_reference_id, status, created_at, updated_at"
    )
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load virtual account.");
  }

  return data ? mapVirtualAccount(data as RawVirtualAccountRow) : null;
}

export async function resolveBusinessIdForContact(
  supabase: SupabaseClient,
  userId: string,
  contactId: string,
  preferredBusinessId?: string | null
): Promise<string | null> {
  if (preferredBusinessId) {
    const { data: preferredBusiness } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", preferredBusinessId)
      .eq("user_id", userId)
      .maybeSingle();

    if (preferredBusiness?.id) {
      return preferredBusiness.id as string;
    }
  }

  const { data: ledgerBusiness } = await supabase
    .from("ledgers")
    .select("business_id")
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .not("business_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ledgerBusiness?.business_id) {
    return ledgerBusiness.business_id as string;
  }

  const { data: firstBusiness } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (firstBusiness?.id as string | undefined) ?? null;
}
