import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import {
  getPurchaseProduct,
  PURCHASE_PRODUCTS,
  PurchaseType,
} from "@/lib/razorpay-products";
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

export async function createRazorpayOrderRecord(
  supabase: SupabaseClient,
  userId: string,
  purchaseType: PurchaseType
): Promise<{
  order: CreatedRazorpayOrder;
  simulated: boolean;
  publicKey: string | null;
}> {
  const product = getPurchaseProduct(purchaseType);
  const receipt = `rcpt_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const credentials = getRazorpayCredentials();
  const isDevelopment = process.env.NEXT_PUBLIC_APP_ENV === "development";

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
      amount: product.amountPaise,
      currency: "INR",
      receipt,
    };

    const { error } = await supabase.from("razorpay_orders").insert({
      user_id: userId,
      razorpay_order_id: simulatedOrderId,
      purchase_type: purchaseType,
      amount_paise: product.amountPaise,
      status: "created",
    });

    if (error) {
      throw new Error(error.message || "Failed to record simulated Razorpay order.");
    }

    return { order, simulated: true, publicKey: null };
  }

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${buildBasicAuth(credentials.keyId, credentials.keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: product.amountPaise,
      currency: "INR",
      receipt,
      notes: {
        user_id: userId,
        purchase_type: purchaseType,
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
    amount_paise: product.amountPaise,
    status: "created",
  });

  if (error) {
    throw new Error(error.message || "Failed to record Razorpay order.");
  }

  return {
    order,
    simulated: false,
    publicKey: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? credentials.keyId,
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
): Promise<{ alreadyFulfilled: boolean; userId: string; purchaseType: PurchaseType }> {
  const { data: orderRow, error: orderError } = await supabase
    .from("razorpay_orders")
    .select("id, user_id, purchase_type, status, amount_paise")
    .eq("razorpay_order_id", razorpayOrderId)
    .single();

  if (orderError || !orderRow) {
    throw new Error("Razorpay order not found.");
  }

  const purchaseType = orderRow.purchase_type as PurchaseType;

  if (orderRow.status === "paid") {
    return {
      alreadyFulfilled: true,
      userId: orderRow.user_id,
      purchaseType,
    };
  }

  const product = getPurchaseProduct(purchaseType);

  if (orderRow.amount_paise !== product.amountPaise) {
    throw new Error("Order amount mismatch. Fulfillment blocked.");
  }

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id, subscription_plan, vapi_wallet_balance")
    .eq("id", orderRow.user_id)
    .single();

  if (userError || !userRow) {
    throw new Error("User not found for Razorpay fulfillment.");
  }

  if (purchaseType === "subscription_premium") {
    const { error: updateError } = await supabase
      .from("users")
      .update({ subscription_plan: "premium" })
      .eq("id", orderRow.user_id);

    if (updateError) {
      throw new Error(updateError.message || "Failed to upgrade subscription.");
    }
  }

  if (purchaseType === "vapi_recharge_100") {
    const currentBalance = Number(userRow.vapi_wallet_balance);
    const creditsToAdd = PURCHASE_PRODUCTS.vapi_recharge_100.credits;

    const { error: updateError } = await supabase
      .from("users")
      .update({ vapi_wallet_balance: currentBalance + creditsToAdd })
      .eq("id", orderRow.user_id);

    if (updateError) {
      throw new Error(updateError.message || "Failed to recharge VAPI wallet.");
    }
  }

  const { error: markPaidError } = await supabase
    .from("razorpay_orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", orderRow.id)
    .eq("status", "created");

  if (markPaidError) {
    throw new Error(markPaidError.message || "Failed to mark order as paid.");
  }

  return {
    alreadyFulfilled: false,
    userId: orderRow.user_id,
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
