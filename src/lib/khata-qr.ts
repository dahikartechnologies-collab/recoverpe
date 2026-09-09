import { getAppBaseUrl } from "@/lib/app-url";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export interface PublicKhataBusiness {
  id: string;
  business_name: string;
  user_id: string;
  khata_auto_approve: boolean;
}

export interface PublicKhataPaymentDetails {
  virtual_upi_id: string | null;
  payee_name: string;
}

export function getKhataQrUrl(businessId: string): string {
  return `${getAppBaseUrl()}/q/${businessId}`;
}

export async function fetchPublicKhataBusiness(
  businessId: string
): Promise<PublicKhataBusiness | null> {
  const normalizedId = businessId.trim();

  if (!normalizedId) {
    return null;
  }

  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("businesses")
    .select("id, business_name, user_id, khata_auto_approve")
    .eq("id", normalizedId)
    .maybeSingle();

  if (error || !data?.business_name) {
    return null;
  }

  return {
    id: data.id as string,
    business_name: data.business_name as string,
    user_id: data.user_id as string,
    khata_auto_approve: Boolean(data.khata_auto_approve),
  };
}

export async function fetchPublicKhataPaymentDetails(
  businessId: string
): Promise<PublicKhataPaymentDetails | null> {
  const business = await fetchPublicKhataBusiness(businessId);

  if (!business) {
    return null;
  }

  const supabase = createAdminSupabaseClient();

  const { data: virtualAccount } = await supabase
    .from("virtual_accounts")
    .select("virtual_upi_id")
    .eq("business_id", businessId)
    .eq("status", "active")
    .not("virtual_upi_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (virtualAccount?.virtual_upi_id) {
    return {
      virtual_upi_id: virtualAccount.virtual_upi_id as string,
      payee_name: business.business_name,
    };
  }

  const { data: userProfile } = await supabase
    .from("users")
    .select("default_upi_vpa, full_name, email")
    .eq("id", business.user_id)
    .maybeSingle();

  const defaultUpi = (userProfile?.default_upi_vpa as string | undefined)?.trim();

  if (defaultUpi) {
    return {
      virtual_upi_id: defaultUpi,
      payee_name:
        (userProfile?.full_name as string | undefined) ||
        business.business_name,
    };
  }

  return null;
}
