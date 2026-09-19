import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { createMerchantBankVerificationOrder } from "@/lib/payments/merchant-bank-verification";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      business_id?: string;
    } | null;

    const businessId = body?.business_id?.trim();

    if (!businessId) {
      return NextResponse.json({ error: "business_id is required." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, business_name")
      .eq("id", businessId)
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const result = await createMerchantBankVerificationOrder(
      supabase,
      auth.userId,
      businessId
    );

    return NextResponse.json({
      success: true,
      simulated: result.simulated,
      order: result.order,
      key: result.publicKey,
      amount_paise: result.amount_paise,
      business_id: businessId,
      message: result.simulated
        ? "Simulated ₹5 bank verification order created."
        : "Bank verification order created successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to initialize bank verification checkout.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
