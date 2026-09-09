import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/api-auth";
import { searchAdminRazorpayOrders } from "@/lib/admin-orders";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const authResult = await requireSuperAdminUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const razorpayOrderId = searchParams.get("razorpay_order_id");
    const userId = searchParams.get("user_id");

    if (!razorpayOrderId?.trim() && !userId?.trim()) {
      return NextResponse.json(
        { error: "Provide razorpay_order_id or user_id to search." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const orders = await searchAdminRazorpayOrders(supabase, {
      razorpayOrderId,
      userId,
    });

    return NextResponse.json({ orders });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to search orders.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
