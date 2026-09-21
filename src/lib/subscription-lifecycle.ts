import { SupabaseClient } from "@supabase/supabase-js";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { getRazorpayCredentials } from "@/lib/razorpay";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "authenticated",
  "created",
  "halted",
]);

function buildBasicAuth(keyId: string, keySecret: string): string {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

async function cancelRazorpaySubscription(subscriptionId: string): Promise<void> {
  const credentials = getRazorpayCredentials();

  if (!credentials || isDevelopmentAppEnv()) {
    return;
  }

  const response = await fetch(
    `https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${buildBasicAuth(credentials.keyId, credentials.keySecret)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cancel_at_cycle_end: false }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay subscription cancel failed: ${errorBody}`);
  }
}

export async function cancelAllActiveSubscriptionsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ cancelledCount: number }> {
  const subscriptionIds = new Set<string>();

  const { data: subscriptionRows, error: subscriptionError } = await supabase
    .from("razorpay_subscriptions")
    .select("id, razorpay_subscription_id, status")
    .eq("user_id", userId)
    .in("status", ["active", "authenticated", "created", "halted"]);

  if (subscriptionError) {
    throw new Error(
      subscriptionError.message || "Failed to load active subscriptions."
    );
  }

  for (const row of subscriptionRows ?? []) {
    if (row.razorpay_subscription_id) {
      subscriptionIds.add(row.razorpay_subscription_id as string);
    }
  }

  const { data: businessRows, error: businessError } = await supabase
    .from("businesses")
    .select("id, razorpay_subscription_id, subscription_status")
    .eq("user_id", userId)
    .not("razorpay_subscription_id", "is", null);

  if (businessError) {
    throw new Error(
      businessError.message || "Failed to load business subscriptions."
    );
  }

  for (const business of businessRows ?? []) {
    const status = (business.subscription_status as string | null) ?? "";
    const razorpaySubscriptionId = business.razorpay_subscription_id as
      | string
      | null;

    if (
      razorpaySubscriptionId &&
      (status === "active" || ACTIVE_SUBSCRIPTION_STATUSES.has(status))
    ) {
      subscriptionIds.add(razorpaySubscriptionId);
    }
  }

  for (const subscriptionId of Array.from(subscriptionIds)) {
    await cancelRazorpaySubscription(subscriptionId);
  }

  if (subscriptionRows && subscriptionRows.length > 0) {
    await supabase
      .from("razorpay_subscriptions")
      .update({ status: "cancelled" })
      .eq("user_id", userId)
      .in("status", ["active", "authenticated", "created", "halted"]);
  }

  if (businessRows && businessRows.length > 0) {
    await supabase
      .from("businesses")
      .update({
        subscription_status: "cancelled",
        subscription_tier: "starter",
      })
      .eq("user_id", userId)
      .in("subscription_status", Array.from(ACTIVE_SUBSCRIPTION_STATUSES));
  }

  return { cancelledCount: subscriptionIds.size };
}

export async function cancelBusinessSubscriptionIfActive(
  supabase: SupabaseClient,
  businessId: string
): Promise<void> {
  const { data: business, error } = await supabase
    .from("businesses")
    .select("razorpay_subscription_id, subscription_status, user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business?.razorpay_subscription_id) {
    return;
  }

  if (business.razorpay_subscription_id === "admin_granted") {
    return;
  }

  const status = (business.subscription_status as string | null) ?? "";

  if (status !== "active" && !ACTIVE_SUBSCRIPTION_STATUSES.has(status)) {
    return;
  }

  await cancelRazorpaySubscription(business.razorpay_subscription_id as string);

  await supabase
    .from("businesses")
    .update({
      subscription_status: "cancelled",
      subscription_tier: "starter",
    })
    .eq("id", businessId);
}
