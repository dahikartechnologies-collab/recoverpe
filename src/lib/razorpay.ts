import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { emitGa4PurchaseEvent } from "@/lib/ga4-measurement";
import {
  getPurchaseProduct,
  getSubscriptionPlanId,
  getSubscriptionTotalCount,
  isMicroTransactionPurchaseType,
  PREMIUM_DISCOUNT_RATE,
  PURCHASE_PRODUCTS,
  PurchaseType,
  SubscriptionPurchaseType,
} from "@/lib/razorpay-products";
import { fulfillMicroTransaction } from "@/lib/micro-transaction-fulfillment";
import { MicroTransactionFulfillment } from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export interface CreatedRazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
}

export interface CreatedRazorpaySubscription {
  id: string;
  plan_id: string;
  status: string;
  current_end?: number;
  short_url?: string;
}

const SUBSCRIPTION_ACTIVE_EVENTS = new Set([
  "subscription.authenticated",
  "subscription.activated",
  "subscription.charged",
  "subscription.resumed",
]);

const SUBSCRIPTION_INACTIVE_EVENTS = new Set([
  "subscription.cancelled",
  "subscription.completed",
  "subscription.halted",
]);

export function isRazorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  );
}

export function getRazorpayCredentials(): RazorpayCredentials | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  return {
    keyId,
    keySecret,
    webhookSecret: webhookSecret ?? "",
  };
}

function buildBasicAuth(keyId: string, keySecret: string): string {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

/** Lightweight connectivity probe — fetches one order page to verify API keys. */
export async function pingRazorpayApi(): Promise<boolean> {
  const credentials = getRazorpayCredentials();

  if (!credentials) {
    return false;
  }

  const response = await fetch("https://api.razorpay.com/v1/orders?count=1", {
    method: "GET",
    headers: {
      Authorization: `Basic ${buildBasicAuth(credentials.keyId, credentials.keySecret)}`,
    },
    cache: "no-store",
  });

  return response.ok;
}

function addIntervalToDate(base: Date, interval: "monthly" | "annual"): Date {
  const next = new Date(base);

  if (interval === "annual") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }

  return next;
}

export async function activatePremiumForUser(
  supabase: SupabaseClient,
  userId: string,
  planInterval: "monthly" | "annual",
  periodEnd?: Date | null
): Promise<void> {
  const expiresAt =
    periodEnd ?? addIntervalToDate(new Date(), planInterval);

  const { error } = await supabase
    .from("users")
    .update({
      subscription_plan: "premium",
      premium_expires_at: expiresAt.toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message || "Failed to activate Premium subscription.");
  }

  const { error: businessTierError } = await supabase
    .from("businesses")
    .update({ subscription_tier: "premium" })
    .eq("user_id", userId);

  if (businessTierError) {
    throw new Error(
      businessTierError.message || "Failed to sync business subscription tier."
    );
  }
}

export async function downgradePremiumIfExpired(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { data: userRow, error } = await supabase
    .from("users")
    .select("subscription_plan, premium_expires_at")
    .eq("id", userId)
    .single();

  if (error || !userRow || userRow.subscription_plan !== "premium") {
    return;
  }

  if (!userRow.premium_expires_at) {
    return;
  }

  if (new Date(userRow.premium_expires_at as string) > new Date()) {
    return;
  }

  await supabase
    .from("users")
    .update({
      subscription_plan: "free",
      premium_expires_at: null,
    })
    .eq("id", userId);

  await supabase
    .from("businesses")
    .update({ subscription_tier: "free" })
    .eq("user_id", userId);
}

export async function createRazorpayOrderRecord(
  supabase: SupabaseClient,
  userId: string,
  purchaseType: PurchaseType,
  amountPaiseOverride?: number,
  ledgerId?: string | null
): Promise<{
  order: CreatedRazorpayOrder;
  simulated: boolean;
  publicKey: string | null;
  amount_paise: number;
  discount_applied: boolean;
}> {
  const product = getPurchaseProduct(purchaseType);
  const amountPaise = amountPaiseOverride ?? product.amountPaise;
  const discountApplied =
    purchaseType === "subscription_premium" &&
    amountPaise < product.amountPaise;
  const receipt = `rcpt_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const credentials = getRazorpayCredentials();
  const isDevelopment = isDevelopmentAppEnv();

  if (!credentials) {
    if (!isDevelopment) {
      throw new Error("Razorpay is not configured for production checkout.");
    }

    console.warn(
      "[Recoverpe Razorpay Dev Bypass] Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET. Using simulated order."
    );

    const simulatedOrderId = `order_dev_${randomUUID().replace(/-/g, "")}`;
    const order: CreatedRazorpayOrder = {
      id: simulatedOrderId,
      amount: amountPaise,
      currency: "INR",
      receipt,
    };

    const { error } = await supabase.from("razorpay_orders").insert({
      user_id: userId,
      razorpay_order_id: simulatedOrderId,
      purchase_type: purchaseType,
      amount_paise: amountPaise,
      status: "created",
      ledger_id: ledgerId ?? null,
    });

    if (error) {
      throw new Error(error.message || "Failed to record simulated Razorpay order.");
    }

    return {
      order,
      simulated: true,
      publicKey: null,
      amount_paise: amountPaise,
      discount_applied: discountApplied,
    };
  }

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${buildBasicAuth(credentials.keyId, credentials.keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        user_id: userId,
        purchase_type: purchaseType,
        discount_applied: discountApplied,
        ledger_id: ledgerId ?? undefined,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay order creation failed: ${errorBody}`);
  }

  const order = (await response.json()) as CreatedRazorpayOrder;

  const { error } = await supabase.from("razorpay_orders").insert({
    user_id: userId,
    razorpay_order_id: order.id,
    purchase_type: purchaseType,
    amount_paise: amountPaise,
    status: "created",
    ledger_id: ledgerId ?? null,
  });

  if (error) {
    throw new Error(error.message || "Failed to record Razorpay order.");
  }

  return {
    order,
    simulated: false,
    publicKey: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? credentials.keyId,
    amount_paise: amountPaise,
    discount_applied: discountApplied,
  };
}

export async function createRazorpaySubscriptionRecord(
  supabase: SupabaseClient,
  userId: string,
  purchaseType: SubscriptionPurchaseType,
  eligibleForDiscount: boolean
): Promise<{
  subscription: CreatedRazorpaySubscription;
  simulated: boolean;
  publicKey: string | null;
  amount_paise: number;
  discount_applied: boolean;
}> {
  const product = PURCHASE_PRODUCTS[purchaseType];
  const planId = getSubscriptionPlanId(purchaseType, eligibleForDiscount);
  const discountApplied =
    purchaseType === "subscription_premium" && eligibleForDiscount;
  const credentials = getRazorpayCredentials();
  const isDevelopment = isDevelopmentAppEnv();

  if (!credentials || !planId) {
    if (!isDevelopment) {
      throw new Error(
        "Razorpay subscription plans are not configured for production checkout."
      );
    }

    console.warn(
      "[Recoverpe Razorpay Dev Bypass] Missing plan IDs or credentials. Using simulated subscription."
    );

    const simulatedSubscriptionId = `sub_dev_${randomUUID().replace(/-/g, "")}`;
    const subscription: CreatedRazorpaySubscription = {
      id: simulatedSubscriptionId,
      plan_id: planId ?? "plan_dev_simulated",
      status: "created",
    };

    const { error } = await supabase.from("razorpay_subscriptions").insert({
      user_id: userId,
      razorpay_subscription_id: simulatedSubscriptionId,
      purchase_type: purchaseType,
      plan_interval: product.planInterval,
      amount_paise: product.amountPaise,
      status: "created",
    });

    if (error) {
      throw new Error(
        error.message || "Failed to record simulated Razorpay subscription."
      );
    }

    return {
      subscription,
      simulated: true,
      publicKey: null,
      amount_paise: product.amountPaise,
      discount_applied: discountApplied,
    };
  }

  const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${buildBasicAuth(credentials.keyId, credentials.keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: planId,
      total_count: getSubscriptionTotalCount(purchaseType),
      customer_notify: 1,
      notes: {
        user_id: userId,
        purchase_type: purchaseType,
        discount_applied: discountApplied,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay subscription creation failed: ${errorBody}`);
  }

  const subscription = (await response.json()) as CreatedRazorpaySubscription;

  const { error } = await supabase.from("razorpay_subscriptions").insert({
    user_id: userId,
    razorpay_subscription_id: subscription.id,
    purchase_type: purchaseType,
    plan_interval: product.planInterval,
    amount_paise: product.amountPaise,
    status: subscription.status ?? "created",
    current_period_end: subscription.current_end
      ? new Date(subscription.current_end * 1000).toISOString()
      : null,
  });

  if (error) {
    throw new Error(error.message || "Failed to record Razorpay subscription.");
  }

  return {
    subscription,
    simulated: false,
    publicKey: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? credentials.keyId,
    amount_paise: product.amountPaise,
    discount_applied: discountApplied,
  };
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret || !signature) {
    return false;
  }

  const expectedSignature = createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function fulfillRazorpayOrder(
  supabase: SupabaseClient,
  razorpayOrderId: string
): Promise<{
  alreadyFulfilled: boolean;
  userId: string;
  purchaseType: PurchaseType;
  microFulfillment: MicroTransactionFulfillment | null;
}> {
  const paidAt = new Date().toISOString();

  const { data: lockedOrder, error: lockError } = await supabase
    .from("razorpay_orders")
    .update({
      status: "paid",
      paid_at: paidAt,
    })
    .eq("razorpay_order_id", razorpayOrderId)
    .eq("status", "created")
    .select("id, user_id, purchase_type, status, amount_paise, ledger_id")
    .maybeSingle();

  if (lockError) {
    throw new Error(lockError.message || "Failed to lock Razorpay order.");
  }

  if (!lockedOrder) {
    const { data: orderRow, error: orderError } = await supabase
      .from("razorpay_orders")
      .select("id, user_id, purchase_type, status, amount_paise, ledger_id")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();

    if (orderError || !orderRow) {
      throw new Error("Razorpay order not found.");
    }

    if (orderRow.status !== "paid") {
      throw new Error("Order could not be fulfilled.");
    }

    const purchaseType = orderRow.purchase_type as PurchaseType;
    let microFulfillment: MicroTransactionFulfillment | null = null;

    if (
      isMicroTransactionPurchaseType(purchaseType) &&
      orderRow.ledger_id
    ) {
      microFulfillment = await fulfillMicroTransaction(
        supabase,
        orderRow.user_id,
        orderRow.ledger_id as string,
        purchaseType as Extract<
          PurchaseType,
          "legal_notice_999" | "samadhaan_499"
        >
      );
    }

    return {
      alreadyFulfilled: true,
      userId: orderRow.user_id,
      purchaseType,
      microFulfillment,
    };
  }

  const purchaseType = lockedOrder.purchase_type as PurchaseType;
  const product = getPurchaseProduct(purchaseType);

  if (purchaseType === "subscription_premium") {
    const allowedPremiumAmounts = new Set([
      product.amountPaise,
      Math.round(product.amountPaise * (1 - PREMIUM_DISCOUNT_RATE)),
    ]);

    if (!allowedPremiumAmounts.has(lockedOrder.amount_paise)) {
      throw new Error("Order amount mismatch. Fulfillment blocked.");
    }
  } else if (lockedOrder.amount_paise !== product.amountPaise) {
    throw new Error("Order amount mismatch. Fulfillment blocked.");
  }

  if (purchaseType === "subscription_premium") {
    await activatePremiumForUser(supabase, lockedOrder.user_id, "monthly");
  }

  if (purchaseType === "vapi_recharge_100") {
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("vapi_wallet_balance")
      .eq("id", lockedOrder.user_id)
      .single();

    if (userError || !userRow) {
      throw new Error("User not found for Razorpay fulfillment.");
    }

    const currentBalance = Number(userRow.vapi_wallet_balance);
    const creditsToAdd = PURCHASE_PRODUCTS.vapi_recharge_100.credits;

    const { error: updateError } = await supabase
      .from("users")
      .update({ vapi_wallet_balance: currentBalance + creditsToAdd })
      .eq("id", lockedOrder.user_id);

    if (updateError) {
      throw new Error(updateError.message || "Failed to recharge VAPI wallet.");
    }
  }

  if (isMicroTransactionPurchaseType(purchaseType) && !lockedOrder.ledger_id) {
    throw new Error("Micro-transaction order is missing ledger context.");
  }

  let microFulfillment: MicroTransactionFulfillment | null = null;

  if (isMicroTransactionPurchaseType(purchaseType) && lockedOrder.ledger_id) {
    microFulfillment = await fulfillMicroTransaction(
      supabase,
      lockedOrder.user_id,
      lockedOrder.ledger_id as string,
      purchaseType as Extract<
        PurchaseType,
        "legal_notice_999" | "samadhaan_499"
      >
    );
  }

  if (
    purchaseType === "legal_notice_999" ||
    purchaseType === "subscription_premium"
  ) {
    emitGa4PurchaseEvent({
      userId: lockedOrder.user_id,
      transactionId: razorpayOrderId,
      purchaseType,
      valueInr: lockedOrder.amount_paise / 100,
    });
  }

  return {
    alreadyFulfilled: false,
    userId: lockedOrder.user_id,
    purchaseType,
    microFulfillment,
  };
}

export async function verifyRazorpayOrderCaptured(
  razorpayOrderId: string
): Promise<boolean> {
  const credentials = getRazorpayCredentials();
  const isDevelopment = isDevelopmentAppEnv();

  if (!credentials) {
    return isDevelopment;
  }

  const response = await fetch(
    `https://api.razorpay.com/v1/orders/${razorpayOrderId}/payments`,
    {
      headers: {
        Authorization: `Basic ${buildBasicAuth(credentials.keyId, credentials.keySecret)}`,
      },
    }
  );

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as {
    items?: Array<{ status?: string }>;
  };

  return Boolean(
    payload.items?.some((payment) => payment.status === "captured")
  );
}

export async function fulfillRazorpaySubscriptionWebhook(
  supabase: SupabaseClient,
  event: string,
  payload: unknown
): Promise<{ handled: boolean; userId?: string; purchaseType?: PurchaseType }> {
  const subscriptionEntity = extractSubscriptionEntityFromWebhook(payload);

  if (!subscriptionEntity?.id) {
    return { handled: false };
  }

  const { data: subscriptionRow, error: subscriptionError } = await supabase
    .from("razorpay_subscriptions")
    .select("id, user_id, purchase_type, plan_interval, status")
    .eq("razorpay_subscription_id", subscriptionEntity.id)
    .maybeSingle();

  if (subscriptionError) {
    throw new Error(subscriptionError.message || "Failed to load subscription.");
  }

  if (!subscriptionRow) {
    return { handled: false };
  }

  const purchaseType = subscriptionRow.purchase_type as SubscriptionPurchaseType;
  const planInterval = subscriptionRow.plan_interval as "monthly" | "annual";
  const periodEnd = subscriptionEntity.current_end
    ? new Date(subscriptionEntity.current_end * 1000)
    : addIntervalToDate(new Date(), planInterval);

  if (SUBSCRIPTION_ACTIVE_EVENTS.has(event)) {
    await activatePremiumForUser(
      supabase,
      subscriptionRow.user_id,
      planInterval,
      periodEnd
    );

    await supabase
      .from("razorpay_subscriptions")
      .update({
        status: subscriptionEntity.status ?? "active",
        current_period_end: periodEnd.toISOString(),
      })
      .eq("id", subscriptionRow.id);

    if (
      purchaseType === "subscription_premium" &&
      event === "subscription.charged"
    ) {
      await supabase
        .from("users")
        .update({ eligible_for_discount: false })
        .eq("id", subscriptionRow.user_id)
        .eq("eligible_for_discount", true);
    }

    if (event === "subscription.charged") {
      const paymentEntity = extractPaymentEntityFromWebhook(payload);
      const product = getPurchaseProduct(purchaseType);
      const valueInr =
        paymentEntity?.amount !== undefined
          ? paymentEntity.amount / 100
          : product.amountPaise / 100;

      emitGa4PurchaseEvent({
        userId: subscriptionRow.user_id,
        transactionId:
          paymentEntity?.id ?? `${subscriptionEntity.id}:${event}`,
        purchaseType,
        valueInr,
      });
    }

    return {
      handled: true,
      userId: subscriptionRow.user_id,
      purchaseType,
    };
  }

  if (SUBSCRIPTION_INACTIVE_EVENTS.has(event)) {
    await supabase
      .from("razorpay_subscriptions")
      .update({
        status: subscriptionEntity.status ?? event.replace("subscription.", ""),
        current_period_end: periodEnd.toISOString(),
      })
      .eq("id", subscriptionRow.id);

    if (event === "subscription.cancelled" || event === "subscription.completed") {
      await supabase
        .from("users")
        .update({
          premium_expires_at: periodEnd.toISOString(),
        })
        .eq("id", subscriptionRow.user_id);
    }

    if (event === "subscription.halted") {
      await downgradePremiumIfExpired(supabase, subscriptionRow.user_id);
    }

    return {
      handled: true,
      userId: subscriptionRow.user_id,
      purchaseType,
    };
  }

  return { handled: false };
}

export async function fulfillSimulatedSubscription(
  supabase: SupabaseClient,
  subscriptionId: string
): Promise<{ userId: string; purchaseType: PurchaseType }> {
  const { data: subscriptionRow, error } = await supabase
    .from("razorpay_subscriptions")
    .select("id, user_id, purchase_type, plan_interval, status")
    .eq("razorpay_subscription_id", subscriptionId)
    .single();

  if (error || !subscriptionRow) {
    throw new Error("Razorpay subscription not found.");
  }

  const purchaseType = subscriptionRow.purchase_type as SubscriptionPurchaseType;
  const planInterval = subscriptionRow.plan_interval as "monthly" | "annual";

  await activatePremiumForUser(supabase, subscriptionRow.user_id, planInterval);

  await supabase
    .from("razorpay_subscriptions")
    .update({
      status: "active",
      current_period_end: addIntervalToDate(new Date(), planInterval).toISOString(),
    })
    .eq("id", subscriptionRow.id);

  return {
    userId: subscriptionRow.user_id,
    purchaseType,
  };
}

export function extractRazorpayOrderIdFromWebhook(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const body = payload as {
    event?: string;
    payload?: {
      payment?: { entity?: { order_id?: string } };
      order?: { entity?: { id?: string } };
    };
  };

  const paymentOrderId = body.payload?.payment?.entity?.order_id;
  if (paymentOrderId) {
    return paymentOrderId;
  }

  const orderId = body.payload?.order?.entity?.id;
  if (orderId) {
    return orderId;
  }

  return null;
}

export function extractPaymentEntityFromWebhook(payload: unknown): {
  id?: string;
  amount?: number;
} | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const body = payload as {
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          amount?: number;
        };
      };
    };
  };

  return body.payload?.payment?.entity ?? null;
}

export function extractSubscriptionEntityFromWebhook(payload: unknown): {
  id: string;
  status?: string;
  current_end?: number;
} | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const body = payload as {
    payload?: {
      subscription?: {
        entity?: {
          id?: string;
          status?: string;
          current_end?: number;
        };
      };
    };
  };

  const entity = body.payload?.subscription?.entity;

  if (!entity?.id) {
    return null;
  }

  return {
    id: entity.id,
    status: entity.status,
    current_end: entity.current_end,
  };
}

export function isSubscriptionWebhookEvent(event: string | undefined): boolean {
  return Boolean(event?.startsWith("subscription."));
}

export async function countUserLedgers(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("ledgers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "Failed to count ledger entries.");
  }

  return count ?? 0;
}
