import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { isPurchaseType } from "@/lib/razorpay-products";
import { createRazorpayOrderRecord } from "@/lib/razorpay";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { CreateRazorpayOrderPayload } from "@/types";

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const body = (await request.json()) as CreateRazorpayOrderPayload;

    if (!body.purchase_type || !isPurchaseType(body.purchase_type)) {
      return NextResponse.json(
        {
          error:
            "purchase_type must be subscription_premium or vapi_recharge_100.",
        },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { order, simulated, publicKey } = await createRazorpayOrderRecord(
      supabase,
      authResult.userId,
      body.purchase_type
    );

    return NextResponse.json({
      success: true,
      simulated,
      order,
      key: publicKey,
      purchase_type: body.purchase_type,
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
