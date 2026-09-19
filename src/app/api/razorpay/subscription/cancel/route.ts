import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { getRazorpayCredentials } from "@/lib/razorpay";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { isDevelopmentAppEnv } from "@/lib/app-env";

export const dynamic = "force-dynamic";

function buildBasicAuth(keyId: string, keySecret: string): string {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const supabase = createAdminSupabaseClient();
    const { data: subscriptionRow, error } = await supabase
      .from("razorpay_subscriptions")
      .select("id, razorpay_subscription_id, status, purchase_type")
      .eq("user_id", auth.userId)
      .in("status", ["active", "authenticated", "created", "halted"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load subscription." },
        { status: 500 }
      );
    }

    if (!subscriptionRow?.razorpay_subscription_id) {
      return NextResponse.json(
        { error: "No active AutoPay subscription found." },
        { status: 404 }
      );
    }

    const subscriptionId = subscriptionRow.razorpay_subscription_id as string;
    const credentials = getRazorpayCredentials();

    if (credentials && !isDevelopmentAppEnv()) {
      const response = await fetch(
        `https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${buildBasicAuth(credentials.keyId, credentials.keySecret)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ cancel_at_cycle_end: 0 }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        return NextResponse.json(
          { error: `Failed to cancel subscription: ${errorBody}` },
          { status: 502 }
        );
      }
    }

    await supabase
      .from("razorpay_subscriptions")
      .update({ status: "cancelled" })
      .eq("id", subscriptionRow.id);

    await supabase
      .from("businesses")
      .update({
        subscription_status: "cancelled",
        subscription_tier: "starter",
      })
      .eq("user_id", auth.userId);

    return NextResponse.json({
      ok: true,
      message: "Subscription cancelled. Premium features will downgrade at period end.",
    });
  } catch (cancelError) {
    const message =
      cancelError instanceof Error
        ? cancelError.message
        : "Failed to cancel subscription.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
