import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import {
  isMicroTransactionPurchaseType,
  isPurchaseType,
  isSubscriptionPurchaseType,
} from "@/lib/razorpay-products";
import { createRazorpayOrderRecord } from "@/lib/razorpay";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import {
  assertSpendFundsPermission,
  resolveWorkspaceAccess,
} from "@/lib/workspace-rbac";
import { CreateRazorpayOrderPayload } from "@/types";

export async function POST(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const body = (await request.json()) as CreateRazorpayOrderPayload;

    if (!body.purchase_type || !isPurchaseType(body.purchase_type)) {
      return NextResponse.json(
        { error: "Invalid purchase_type." },
        { status: 400 }
      );
    }

    if (isSubscriptionPurchaseType(body.purchase_type)) {
      return NextResponse.json(
        {
          error:
            "Premium subscriptions must be created via /api/razorpay/subscription.",
        },
        { status: 400 }
      );
    }

    if (isMicroTransactionPurchaseType(body.purchase_type)) {
      const access = await resolveWorkspaceAccess(
        contextResult.actorUserId,
        contextResult.effectiveUserId
      );

      try {
        assertSpendFundsPermission(access);
      } catch (permissionError) {
        return NextResponse.json(
          {
            error:
              permissionError instanceof Error
                ? permissionError.message
                : "Forbidden.",
          },
          { status: 403 }
        );
      }
    }

    const supabase = createAdminSupabaseClient();

    const { error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", contextResult.effectiveUserId)
      .single();

    if (userError) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    let ledgerId: string | null = null;

    if (isMicroTransactionPurchaseType(body.purchase_type)) {
      ledgerId = body.ledger_id?.trim() ?? null;

      if (!ledgerId) {
        return NextResponse.json(
          { error: "ledger_id is required for this purchase." },
          { status: 400 }
        );
      }

      const { data: ledgerRow, error: ledgerError } = await supabase
        .from("ledgers")
        .select("id, balance_due, status")
        .eq("id", ledgerId)
        .eq("user_id", contextResult.effectiveUserId)
        .maybeSingle();

      if (ledgerError || !ledgerRow) {
        return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
      }

      if (
        Number(ledgerRow.balance_due) <= 0 ||
        ["paid", "cancelled", "refunded"].includes(ledgerRow.status as string)
      ) {
        return NextResponse.json(
          { error: "This ledger is not eligible for micro-transactions." },
          { status: 400 }
        );
      }
    }

    const amountPaiseOverride = undefined;

    const { order, simulated, publicKey, amount_paise, discount_applied } =
      await createRazorpayOrderRecord(
        supabase,
        contextResult.effectiveUserId,
        body.purchase_type,
        amountPaiseOverride,
        ledgerId
      );

    return NextResponse.json({
      success: true,
      simulated,
      order,
      key: publicKey,
      purchase_type: body.purchase_type,
      amount_paise,
      discount_applied,
      message: simulated
        ? "Simulated Razorpay order created for development checkout."
        : "Razorpay order created successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create Razorpay order.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
