import { randomUUID } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import {
  CreatedRazorpayOrder,
  getRazorpayCredentials,
} from "@/lib/razorpay";
import { MERCHANT_BANK_VERIFICATION_AMOUNT_PAISE } from "@/lib/razorpay-products";
import {
  MerchantBankAccountType,
  parseMerchantBankAccountType,
  shouldMarkAccountPrimary,
} from "@/lib/payments/merchant-bank-account-type";

export const MERCHANT_BANK_VERIFICATION_PURCHASE_TYPE = "bank_verification_5";
export {
  parseMerchantBankAccountType,
  shouldMarkAccountPrimary,
};
export type { MerchantBankAccountType };

export const MERCHANT_BANK_ACCOUNT_SELECT =
  "id, business_id, account_number, ifsc, upi_vpa, is_verified, verification_payment_id, account_type, is_primary, created_at";

export interface MerchantBankAccountRecord {
  id: string;
  business_id: string;
  account_number: string | null;
  ifsc: string | null;
  upi_vpa: string | null;
  is_verified: boolean;
  verification_payment_id: string | null;
  account_type: MerchantBankAccountType;
  is_primary: boolean;
  created_at: string;
}

export interface CapturedPaymentSource {
  paymentId: string;
  method?: string;
  upiVpa?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
}

function buildBasicAuth(keyId: string, keySecret: string): string {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

function mapMerchantBankAccountRow(
  data: Record<string, unknown>
): MerchantBankAccountRecord {
  return {
    id: data.id as string,
    business_id: data.business_id as string,
    account_number: (data.account_number as string | null) ?? null,
    ifsc: (data.ifsc as string | null) ?? null,
    upi_vpa: (data.upi_vpa as string | null) ?? null,
    is_verified: Boolean(data.is_verified),
    verification_payment_id:
      (data.verification_payment_id as string | null) ?? null,
    account_type: parseMerchantBankAccountType(data.account_type),
    is_primary: Boolean(data.is_primary),
    created_at: data.created_at as string,
  };
}

export async function createMerchantBankVerificationOrder(
  supabase: SupabaseClient,
  userId: string,
  businessId: string,
  accountType: MerchantBankAccountType = "business"
): Promise<{
  order: CreatedRazorpayOrder;
  simulated: boolean;
  publicKey: string | null;
  amount_paise: number;
  account_type: MerchantBankAccountType;
}> {
  const amountPaise = MERCHANT_BANK_VERIFICATION_AMOUNT_PAISE;
  const receipt = `bnk_${randomUUID().replace(/-/g, "").slice(0, 18)}`;
  const credentials = getRazorpayCredentials();
  const isDevelopment = isDevelopmentAppEnv();
  const resolvedAccountType = parseMerchantBankAccountType(accountType);

  if (!credentials) {
    if (!isDevelopment) {
      throw new Error("Razorpay is not configured for bank verification checkout.");
    }

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
      purchase_type: MERCHANT_BANK_VERIFICATION_PURCHASE_TYPE,
      amount_paise: amountPaise,
      status: "created",
      business_id: businessId,
      verification_account_type: resolvedAccountType,
    });

    if (error) {
      throw new Error(error.message || "Failed to record simulated verification order.");
    }

    return {
      order,
      simulated: true,
      publicKey: null,
      amount_paise: amountPaise,
      account_type: resolvedAccountType,
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
        type: "bank_verification",
        business_id: businessId,
        user_id: userId,
        purchase_type: MERCHANT_BANK_VERIFICATION_PURCHASE_TYPE,
        account_type: resolvedAccountType,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay bank verification order failed: ${errorBody}`);
  }

  const order = (await response.json()) as CreatedRazorpayOrder;

  const { error } = await supabase.from("razorpay_orders").insert({
    user_id: userId,
    razorpay_order_id: order.id,
    purchase_type: MERCHANT_BANK_VERIFICATION_PURCHASE_TYPE,
    amount_paise: amountPaise,
    status: "created",
    business_id: businessId,
    verification_account_type: resolvedAccountType,
  });

  if (error) {
    throw new Error(error.message || "Failed to record bank verification order.");
  }

  return {
    order,
    simulated: false,
    publicKey: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? credentials.keyId,
    amount_paise: amountPaise,
    account_type: resolvedAccountType,
  };
}

export function extractPaymentSourceFromWebhook(
  payload: unknown
): CapturedPaymentSource | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const body = payload as {
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          method?: string;
          vpa?: string;
          bank?: string;
          acquirer_data?: {
            account_number?: string;
            ifsc?: string;
          };
        };
      };
    };
  };

  const entity = body.payload?.payment?.entity;

  if (!entity?.id) {
    return null;
  }

  return {
    paymentId: entity.id,
    method: entity.method,
    upiVpa: entity.vpa ?? null,
    accountNumber: entity.acquirer_data?.account_number ?? null,
    ifsc: entity.acquirer_data?.ifsc ?? null,
  };
}

export function extractBankVerificationNotesFromWebhook(
  payload: unknown
): {
  businessId: string | null;
  type: string | null;
  accountType: MerchantBankAccountType;
} {
  if (!payload || typeof payload !== "object") {
    return { businessId: null, type: null, accountType: "business" };
  }

  const body = payload as {
    payload?: {
      payment?: {
        entity?: {
          notes?: Record<string, string>;
        };
      };
      order?: {
        entity?: {
          notes?: Record<string, string>;
        };
      };
    };
  };

  const paymentNotes = body.payload?.payment?.entity?.notes ?? {};
  const orderNotes = body.payload?.order?.entity?.notes ?? {};
  const notes = { ...orderNotes, ...paymentNotes };

  return {
    type: notes.type ?? null,
    businessId: notes.business_id ?? null,
    accountType: parseMerchantBankAccountType(notes.account_type),
  };
}

async function fetchCapturedPaymentForOrder(
  razorpayOrderId: string
): Promise<CapturedPaymentSource | null> {
  const credentials = getRazorpayCredentials();

  if (!credentials) {
    if (!isDevelopmentAppEnv()) {
      return null;
    }

    return {
      paymentId: `pay_dev_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
      method: "upi",
      upiVpa: "verified.merchant@recoverpe",
      accountNumber: null,
      ifsc: null,
    };
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
    return null;
  }

  const payload = (await response.json()) as {
    items?: Array<{
      id?: string;
      status?: string;
      method?: string;
      vpa?: string;
      acquirer_data?: {
        account_number?: string;
        ifsc?: string;
      };
    }>;
  };

  const captured =
    payload.items?.find((item) => item.status === "captured") ??
    payload.items?.[0];

  if (!captured?.id) {
    return null;
  }

  return {
    paymentId: captured.id,
    method: captured.method,
    upiVpa: captured.vpa ?? null,
    accountNumber: captured.acquirer_data?.account_number ?? null,
    ifsc: captured.acquirer_data?.ifsc ?? null,
  };
}

export async function persistVerifiedMerchantBankAccount(
  supabase: SupabaseClient,
  input: {
    businessId: string;
    paymentSource: CapturedPaymentSource;
    accountType?: MerchantBankAccountType;
  }
): Promise<MerchantBankAccountRecord> {
  const verifiedAt = new Date().toISOString();
  const accountType = parseMerchantBankAccountType(input.accountType);
  let upiVpa = input.paymentSource.upiVpa?.trim() || null;
  let accountNumber =
    input.paymentSource.accountNumber?.replace(/\s/g, "") || null;
  let ifsc = input.paymentSource.ifsc?.trim().toUpperCase() || null;

  if (!upiVpa && (!accountNumber || !ifsc)) {
    if (!isDevelopmentAppEnv()) {
      throw new Error(
        "Unable to capture payer bank or UPI details from the verification payment."
      );
    }

    upiVpa = upiVpa ?? "verified.merchant@recoverpe";
    accountNumber = accountNumber ?? "000111222333";
    ifsc = ifsc ?? "HDFC0000001";
  }

  const { count, error: countError } = await supabase
    .from("merchant_bank_accounts")
    .select("id", { count: "exact", head: true })
    .eq("business_id", input.businessId)
    .eq("is_verified", true);

  if (countError) {
    throw new Error(countError.message || "Failed to load existing bank accounts.");
  }

  const isPrimary = shouldMarkAccountPrimary(count ?? 0);

  const { data, error } = await supabase
    .from("merchant_bank_accounts")
    .insert({
      business_id: input.businessId,
      account_number: accountNumber,
      ifsc,
      upi_vpa: upiVpa,
      is_verified: true,
      verification_payment_id: input.paymentSource.paymentId,
      account_type: accountType,
      is_primary: isPrimary,
    })
    .select(MERCHANT_BANK_ACCOUNT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to save verified bank account.");
  }

  const businessUpdate: Record<string, unknown> = {
    bank_verified_at: verifiedAt,
    kyc_verified_at: verifiedAt,
  };

  if (isPrimary) {
    businessUpdate.payout_bank_account_number = accountNumber;
    businessUpdate.payout_bank_ifsc = ifsc;
  }

  await supabase.from("businesses").update(businessUpdate).eq("id", input.businessId);

  return mapMerchantBankAccountRow(data as Record<string, unknown>);
}

export async function fulfillMerchantBankVerificationOrder(
  supabase: SupabaseClient,
  razorpayOrderId: string,
  paymentSource?: CapturedPaymentSource | null,
  accountTypeOverride?: MerchantBankAccountType
): Promise<{ businessId: string; account: MerchantBankAccountRecord }> {
  const paidAt = new Date().toISOString();

  const { data: lockedOrder, error: lockError } = await supabase
    .from("razorpay_orders")
    .update({ status: "paid", paid_at: paidAt })
    .eq("razorpay_order_id", razorpayOrderId)
    .eq("status", "created")
    .eq("purchase_type", MERCHANT_BANK_VERIFICATION_PURCHASE_TYPE)
    .select("id, business_id, amount_paise, verification_account_type")
    .maybeSingle();

  if (lockError) {
    throw new Error(lockError.message || "Failed to lock bank verification order.");
  }

  if (!lockedOrder?.business_id) {
    const { data: existingOrder } = await supabase
      .from("razorpay_orders")
      .select("business_id, status, verification_account_type")
      .eq("razorpay_order_id", razorpayOrderId)
      .eq("purchase_type", MERCHANT_BANK_VERIFICATION_PURCHASE_TYPE)
      .maybeSingle();

    if (existingOrder?.status === "paid" && existingOrder.business_id) {
      const { data: account } = await supabase
        .from("merchant_bank_accounts")
        .select(MERCHANT_BANK_ACCOUNT_SELECT)
        .eq("business_id", existingOrder.business_id)
        .eq("is_verified", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (account) {
        return {
          businessId: existingOrder.business_id as string,
          account: mapMerchantBankAccountRow(account as Record<string, unknown>),
        };
      }
    }

    throw new Error("Bank verification order not found.");
  }

  if (lockedOrder.amount_paise !== MERCHANT_BANK_VERIFICATION_AMOUNT_PAISE) {
    throw new Error("Bank verification order amount mismatch.");
  }

  const resolvedPaymentSource =
    paymentSource ?? (await fetchCapturedPaymentForOrder(razorpayOrderId));

  if (!resolvedPaymentSource) {
    throw new Error("Captured verification payment not found.");
  }

  const account = await persistVerifiedMerchantBankAccount(supabase, {
    businessId: lockedOrder.business_id as string,
    paymentSource: resolvedPaymentSource,
    accountType: parseMerchantBankAccountType(
      accountTypeOverride ?? lockedOrder.verification_account_type
    ),
  });

  return {
    businessId: lockedOrder.business_id as string,
    account,
  };
}

export async function handleMerchantBankVerificationWebhook(
  supabase: SupabaseClient,
  payload: unknown,
  razorpayOrderId: string
): Promise<{ handled: boolean; businessId?: string }> {
  const notes = extractBankVerificationNotesFromWebhook(payload);

  const { data: orderRow } = await supabase
    .from("razorpay_orders")
    .select("purchase_type, business_id")
    .eq("razorpay_order_id", razorpayOrderId)
    .maybeSingle();

  const isBankVerificationOrder =
    orderRow?.purchase_type === MERCHANT_BANK_VERIFICATION_PURCHASE_TYPE ||
    notes.type === "bank_verification";

  if (!isBankVerificationOrder) {
    return { handled: false };
  }

  const paymentSource = extractPaymentSourceFromWebhook(payload);
  const result = await fulfillMerchantBankVerificationOrder(
    supabase,
    razorpayOrderId,
    paymentSource,
    notes.accountType
  );

  return {
    handled: true,
    businessId: result.businessId,
  };
}
