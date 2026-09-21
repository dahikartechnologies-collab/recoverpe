import { randomUUID } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import {
  CreatedRazorpayOrder,
  getRazorpayCredentials,
} from "@/lib/razorpay";
import {
  calculateWalletRechargeBreakdown,
  calculateWalletRechargeTotalPaise,
  validateWalletRechargeBaseAmount,
} from "@/lib/vapi-pricing";

function buildBasicAuth(keyId: string, keySecret: string): string {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

export interface CreatedWalletRechargeOrder {
  order: CreatedRazorpayOrder;
  simulated: boolean;
  publicKey: string | null;
  base_amount_inr: number;
  gst_amount_inr: number;
  total_payable_inr: number;
  amount_paise: number;
}

export async function creditVapiWalletBalance(
  supabase: SupabaseClient,
  userId: string,
  baseCreditInr: number
): Promise<number> {
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("vapi_wallet_balance")
    .eq("id", userId)
    .single();

  if (userError || !userRow) {
    throw new Error("User not found for wallet recharge.");
  }

  const currentBalance = Number(userRow.vapi_wallet_balance);
  const nextBalance = currentBalance + baseCreditInr;

  const { error: updateError } = await supabase
    .from("users")
    .update({ vapi_wallet_balance: nextBalance })
    .eq("id", userId);

  if (updateError) {
    throw new Error(updateError.message || "Failed to credit AI Voice Wallet.");
  }

  return nextBalance;
}

export async function createWalletRechargeOrder(
  supabase: SupabaseClient,
  userId: string,
  baseAmountInr: number
): Promise<CreatedWalletRechargeOrder> {
  const validationError = validateWalletRechargeBaseAmount(baseAmountInr);

  if (validationError) {
    throw new Error(validationError);
  }

  const base_amount_inr = Math.trunc(baseAmountInr);
  const breakdown = calculateWalletRechargeBreakdown(base_amount_inr);
  const amountPaise = calculateWalletRechargeTotalPaise(base_amount_inr);
  const receipt = `wallet_${randomUUID().replace(/-/g, "").slice(0, 18)}`;
  const credentials = getRazorpayCredentials();
  const isDevelopment = isDevelopmentAppEnv();

  if (!credentials) {
    if (!isDevelopment) {
      throw new Error("Razorpay is not configured for production checkout.");
    }

    const simulatedOrderId = `order_wallet_dev_${randomUUID().replace(/-/g, "")}`;
    const order: CreatedRazorpayOrder = {
      id: simulatedOrderId,
      amount: amountPaise,
      currency: "INR",
      receipt,
    };

    const { error } = await supabase.from("razorpay_orders").insert({
      user_id: userId,
      razorpay_order_id: simulatedOrderId,
      purchase_type: "wallet_recharge",
      amount_paise: amountPaise,
      wallet_base_credit_inr: base_amount_inr,
      status: "created",
    });

    if (error) {
      throw new Error(error.message || "Failed to record simulated wallet order.");
    }

    return {
      order,
      simulated: true,
      publicKey: null,
      base_amount_inr: breakdown.base_amount_inr,
      gst_amount_inr: breakdown.gst_amount_inr,
      total_payable_inr: breakdown.total_payable_inr,
      amount_paise: amountPaise,
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
        type: "wallet_recharge",
        base_credit: String(base_amount_inr),
        user_id: userId,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay wallet order creation failed: ${errorBody}`);
  }

  const order = (await response.json()) as CreatedRazorpayOrder;

  const { error } = await supabase.from("razorpay_orders").insert({
    user_id: userId,
    razorpay_order_id: order.id,
    purchase_type: "wallet_recharge",
    amount_paise: amountPaise,
    wallet_base_credit_inr: base_amount_inr,
    status: "created",
  });

  if (error) {
    throw new Error(error.message || "Failed to record wallet recharge order.");
  }

  return {
    order,
    simulated: false,
    publicKey: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? credentials.keyId,
    base_amount_inr: breakdown.base_amount_inr,
    gst_amount_inr: breakdown.gst_amount_inr,
    total_payable_inr: breakdown.total_payable_inr,
    amount_paise: amountPaise,
  };
}

export function extractWalletRechargeBaseCreditFromNotes(
  notes: Record<string, unknown> | null | undefined
): number | null {
  if (!notes || notes.type !== "wallet_recharge") {
    return null;
  }

  const raw =
    notes.base_credit ??
    notes.baseCredit ??
    notes.base_amount ??
    notes.baseAmount;

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.trunc(parsed);
}

export function extractRazorpayWebhookNotes(
  payload: unknown
): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const body = payload as {
    payload?: {
      payment?: { entity?: { notes?: Record<string, unknown> } };
      order?: { entity?: { notes?: Record<string, unknown> } };
    };
  };

  return (
    body.payload?.payment?.entity?.notes ??
    body.payload?.order?.entity?.notes ??
    null
  );
}

export async function fulfillWalletRechargeOrder(
  supabase: SupabaseClient,
  razorpayOrderId: string,
  baseCreditInr: number
): Promise<{
  alreadyFulfilled: boolean;
  userId: string;
  wallet_balance: number;
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
    .select("id, user_id, purchase_type, wallet_base_credit_inr")
    .maybeSingle();

  if (lockError) {
    throw new Error(lockError.message || "Failed to lock wallet recharge order.");
  }

  if (!lockedOrder) {
    const { data: existingOrder, error: existingError } = await supabase
      .from("razorpay_orders")
      .select("user_id, status, wallet_base_credit_inr")
      .eq("razorpay_order_id", razorpayOrderId)
      .maybeSingle();

    if (existingError || !existingOrder) {
      throw new Error("Wallet recharge order not found.");
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("vapi_wallet_balance")
      .eq("id", existingOrder.user_id)
      .single();

    return {
      alreadyFulfilled: existingOrder.status === "paid",
      userId: existingOrder.user_id,
      wallet_balance: Number(userRow?.vapi_wallet_balance ?? 0),
    };
  }

  if (lockedOrder.purchase_type !== "wallet_recharge") {
    throw new Error("Order is not a wallet recharge.");
  }

  const creditAmount = Number(
    lockedOrder.wallet_base_credit_inr ?? baseCreditInr
  );

  if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
    throw new Error("Wallet recharge base credit is invalid.");
  }

  const wallet_balance = await creditVapiWalletBalance(
    supabase,
    lockedOrder.user_id,
    creditAmount
  );

  return {
    alreadyFulfilled: false,
    userId: lockedOrder.user_id,
    wallet_balance,
  };
}

export async function tryFulfillWalletRechargeWebhook(
  supabase: SupabaseClient,
  payload: unknown,
  razorpayOrderId: string
): Promise<{
  handled: boolean;
  userId?: string;
  baseCreditInr?: number;
  walletBalance?: number;
  alreadyFulfilled?: boolean;
}> {
  const notes = extractRazorpayWebhookNotes(payload);
  const baseCreditFromNotes = extractWalletRechargeBaseCreditFromNotes(notes);

  if (!baseCreditFromNotes) {
    return { handled: false };
  }

  const result = await fulfillWalletRechargeOrder(
    supabase,
    razorpayOrderId,
    baseCreditFromNotes
  );

  return {
    handled: true,
    userId: result.userId,
    baseCreditInr: baseCreditFromNotes,
    walletBalance: result.wallet_balance,
    alreadyFulfilled: result.alreadyFulfilled,
  };
}
