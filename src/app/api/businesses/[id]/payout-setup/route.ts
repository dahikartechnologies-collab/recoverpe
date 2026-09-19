import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import {
  createRazorpayLinkedAccount,
  validateMerchantPayoutInput,
} from "@/lib/payments/razorpay-route";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

interface RouteContext {
  params: { id: string };
}

export const POST = withWorkspaceMutation<RouteContext>(
  async (request, auth, context) => {
    const businessId = context.params.id?.trim();

    if (!businessId) {
      return NextResponse.json({ error: "Business ID is required." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as {
      merchant_bank_account_id?: string;
      payout_pan?: string;
      payout_account_holder_name?: string;
    } | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const merchantBankAccountId = body.merchant_bank_account_id?.trim();

    if (!merchantBankAccountId) {
      return NextResponse.json(
        {
          error:
            "merchant_bank_account_id is required. Verify your bank via Secure Bank Linking first.",
        },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, user_id, business_name, razorpay_linked_account_id")
      .eq("id", businessId)
      .eq("user_id", auth.actorUserId)
      .maybeSingle();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const { data: verifiedAccount, error: accountError } = await supabase
      .from("merchant_bank_accounts")
      .select("id, account_number, ifsc, upi_vpa, is_verified")
      .eq("id", merchantBankAccountId)
      .eq("business_id", businessId)
      .eq("is_verified", true)
      .maybeSingle();

    if (accountError || !verifiedAccount) {
      return NextResponse.json(
        { error: "Selected settlement account is not verified for this business." },
        { status: 400 }
      );
    }

    if (!verifiedAccount.account_number || !verifiedAccount.ifsc) {
      return NextResponse.json(
        {
          error:
            "This verified account does not include bank routing details required for Razorpay Route.",
        },
        { status: 400 }
      );
    }

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("email, phone_number")
      .eq("id", auth.actorUserId)
      .single();

    if (userError || !userRow?.email) {
      return NextResponse.json({ error: "User email is required." }, { status: 400 });
    }

    const payoutInput = {
      businessId,
      businessName: business.business_name as string,
      payoutPan: body.payout_pan ?? "",
      payoutBankAccountNumber: verifiedAccount.account_number as string,
      payoutBankIfsc: verifiedAccount.ifsc as string,
      payoutAccountHolderName: body.payout_account_holder_name ?? "",
      contactEmail: userRow.email as string,
      contactPhone: (userRow.phone_number as string | null) ?? null,
    };

    try {
      validateMerchantPayoutInput(payoutInput);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Invalid payout details.",
        },
        { status: 400 }
      );
    }

    if (business.razorpay_linked_account_id) {
      const { error: updateError } = await supabase
        .from("businesses")
        .update({
          payout_pan: payoutInput.payoutPan.trim().toUpperCase(),
          payout_bank_account_number: payoutInput.payoutBankAccountNumber.replace(
            /\s/g,
            ""
          ),
          payout_bank_ifsc: payoutInput.payoutBankIfsc.trim().toUpperCase(),
          payout_account_holder_name: payoutInput.payoutAccountHolderName.trim(),
        })
        .eq("id", businessId);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message || "Failed to save payout details." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Payout details updated from verified settlement account.",
        route_status: "active",
      });
    }

    try {
      const linkedAccount = await createRazorpayLinkedAccount(payoutInput);

      const { error: updateError } = await supabase
        .from("businesses")
        .update({
          payout_pan: payoutInput.payoutPan.trim().toUpperCase(),
          payout_bank_account_number: payoutInput.payoutBankAccountNumber.replace(
            /\s/g,
            ""
          ),
          payout_bank_ifsc: payoutInput.payoutBankIfsc.trim().toUpperCase(),
          payout_account_holder_name: payoutInput.payoutAccountHolderName.trim(),
          razorpay_linked_account_id: linkedAccount.linkedAccountId,
          razorpay_route_status: linkedAccount.routeStatus,
        })
        .eq("id", businessId);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message || "Failed to save payout details." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message:
          linkedAccount.routeStatus === "active"
            ? "Verified settlement account linked. Smart Collect payouts are locked to this source."
            : "Verified settlement account submitted. Razorpay is completing verification.",
        route_status: linkedAccount.routeStatus,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to configure payout account.",
        },
        { status: 500 }
      );
    }
  },
  { ownerOnly: true }
);
