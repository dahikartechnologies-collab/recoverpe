import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import { getSafeApiErrorMessage } from "@/lib/api-error-response";
import { createWalletRechargeOrder } from "@/lib/wallet-recharge";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { validateWalletRechargeBaseAmount } from "@/lib/vapi-pricing";

export const POST = withWorkspaceMutation(async (request, auth) => {
  try {
    const body = (await request.json()) as { baseAmount?: number };
    const baseAmount = Number(body.baseAmount);
    const validationError = validateWalletRechargeBaseAmount(baseAmount);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const result = await createWalletRechargeOrder(
      supabase,
      auth.actorUserId,
      Math.trunc(baseAmount)
    );

    return NextResponse.json({
      success: true,
      simulated: result.simulated,
      order: result.order,
      key: result.publicKey,
      base_amount_inr: result.base_amount_inr,
      gst_amount_inr: result.gst_amount_inr,
      total_payable_inr: result.total_payable_inr,
      amount_paise: result.amount_paise,
      message: result.simulated
        ? "Simulated wallet recharge order created for development checkout."
        : "Wallet recharge order created successfully.",
    });
  } catch (error) {
    console.error(
      "[checkout/create-wallet-recharge] Failed:",
      error instanceof Error ? error.message : error
    );

    return NextResponse.json(
      {
        error: getSafeApiErrorMessage(
          error,
          "Failed to create wallet recharge order."
        ),
      },
      { status: 500 }
    );
  }
}, { ownerOnly: true });
