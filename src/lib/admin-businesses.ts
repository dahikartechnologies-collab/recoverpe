import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { AdminManagedBusiness } from "@/types";
import { mapAdminBusinessRow } from "@/lib/admin-grant-tier";

export async function fetchAllAdminBusinesses(): Promise<AdminManagedBusiness[]> {
  const supabase = createAdminSupabaseClient();

  const { data: businesses, error } = await supabase
    .from("businesses")
    .select(
      "id, user_id, business_name, subscription_tier, subscription_status, subscription_expires_at, razorpay_subscription_id, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message || "Failed to load businesses.");
  }

  const ownerIds = Array.from(
    new Set((businesses ?? []).map((row) => row.user_id as string))
  );

  const ownerEmailById = new Map<string, string>();

  if (ownerIds.length > 0) {
    const { data: owners, error: ownersError } = await supabase
      .from("users")
      .select("id, email")
      .in("id", ownerIds);

    if (ownersError) {
      throw new Error(ownersError.message || "Failed to load business owners.");
    }

    for (const owner of owners ?? []) {
      ownerEmailById.set(owner.id as string, owner.email as string);
    }
  }

  return (businesses ?? []).map((row) =>
    mapAdminBusinessRow(
      row as Record<string, unknown>,
      ownerEmailById.get(row.user_id as string) ?? "unknown@recoverpe.com"
    )
  );
}
