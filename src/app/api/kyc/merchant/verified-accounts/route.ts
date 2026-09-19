import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import type { MerchantBankAccountRecord } from "@/lib/payments/merchant-bank-verification";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("business_id")?.trim();

    if (!businessId) {
      return NextResponse.json({ error: "business_id is required." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", businessId)
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("merchant_bank_accounts")
      .select(
        "id, business_id, account_number, ifsc, upi_vpa, is_verified, verification_payment_id, created_at"
      )
      .eq("business_id", businessId)
      .eq("is_verified", true)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load verified bank accounts." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      accounts: (data ?? []) as MerchantBankAccountRecord[],
    });
  } catch (loadError) {
    const message =
      loadError instanceof Error
        ? loadError.message
        : "Failed to load verified bank accounts.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
