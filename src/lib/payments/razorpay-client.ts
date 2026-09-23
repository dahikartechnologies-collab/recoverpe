import Razorpay from "razorpay";
import { randomUUID } from "crypto";
import { isDevelopmentAppEnv } from "@/lib/app-env";

export interface VirtualAccountReceiverDetails {
  id: string;
  virtualUpiId: string | null;
  virtualAccountNumber: string | null;
  ifscCode: string | null;
}

interface RazorpayVirtualAccountReceiver {
  entity?: string;
  address?: string;
  account_number?: string;
  ifsc?: string;
}

interface RazorpayVirtualAccountEntity {
  id: string;
  receivers?: RazorpayVirtualAccountReceiver[];
}

let razorpayClient: Razorpay | null = null;

function getRazorpayClient(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  return razorpayClient;
}

export function sanitizeVpaDescriptor(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);

  return normalized || "vendor";
}

function parseVirtualAccountEntity(
  entity: RazorpayVirtualAccountEntity
): Omit<VirtualAccountReceiverDetails, "id"> {
  const receivers = entity.receivers ?? [];
  const vpaReceiver = receivers.find((receiver) => receiver.entity === "vpa");
  const bankReceiver = receivers.find(
    (receiver) => receiver.entity === "bank_account"
  );

  return {
    virtualUpiId: vpaReceiver?.address ?? null,
    virtualAccountNumber: bankReceiver?.account_number ?? null,
    ifscCode: bankReceiver?.ifsc ?? null,
  };
}

function buildDevelopmentVirtualAccount(
  contactName: string
): VirtualAccountReceiverDetails {
  const descriptor = sanitizeVpaDescriptor(contactName);

  return {
    id: `va_dev_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
    virtualUpiId: `recoverpe.${descriptor}@razorpay`,
    virtualAccountNumber: "1234567890123456",
    ifscCode: "RAZR0000000",
  };
}

export async function createVirtualAccount(
  contactName: string
): Promise<VirtualAccountReceiverDetails> {
  const client = getRazorpayClient();
  const isDevelopment = isDevelopmentAppEnv();

  if (!client) {
    if (!isDevelopment) {
      throw new Error("Razorpay is not configured for virtual account provisioning.");
    }

    return buildDevelopmentVirtualAccount(contactName);
  }

  const descriptor = sanitizeVpaDescriptor(contactName);

  const customer = (await client.customers.create({
    name: contactName.trim(),
    fail_existing: 0,
  })) as { id: string };

  const virtualAccount = (await client.virtualAccounts.create({
    receivers: {
      types: ["vpa", "bank_account"],
      vpa: {
        descriptor,
      },
      bank_account: {
        descriptor: descriptor.slice(0, 10),
      },
    },
    description: `Recoverpe Smart Collect — ${contactName.trim()}`,
    customer_id: customer.id,
  } as never)) as unknown as RazorpayVirtualAccountEntity;

  const parsed = parseVirtualAccountEntity(virtualAccount);

  if (!parsed.virtualUpiId && !parsed.virtualAccountNumber) {
    throw new Error(
      "Razorpay virtual account response did not include payment details."
    );
  }

  return {
    id: virtualAccount.id,
    ...parsed,
  };
}

export function extractRazorpaySdkError(error: unknown): string {
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const nested = record.error;

    if (nested && typeof nested === "object") {
      const nestedError = nested as Record<string, unknown>;

      if (
        typeof nestedError.description === "string" &&
        nestedError.description.trim()
      ) {
        return nestedError.description.trim();
      }

      if (typeof nestedError.reason === "string" && nestedError.reason.trim()) {
        return nestedError.reason.trim();
      }

      if (typeof nestedError.code === "string" && nestedError.code.trim()) {
        return nestedError.code.trim();
      }
    }

    if (typeof record.description === "string" && record.description.trim()) {
      return record.description.trim();
    }

    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return "Razorpay subscription creation failed.";
}

export interface CreateRazorpaySubscriptionInput {
  planId: string;
  totalCount: number;
  notes: Record<string, string | number>;
}

export async function createRazorpaySubscription(
  input: CreateRazorpaySubscriptionInput
): Promise<CreatedRazorpaySubscriptionEntity> {
  const client = getRazorpayClient();

  if (!client) {
    throw new Error("Razorpay credentials are not configured.");
  }

  try {
    const subscription = (await client.subscriptions.create({
      plan_id: input.planId,
      total_count: input.totalCount,
      customer_notify: 1,
      notes: input.notes,
    })) as CreatedRazorpaySubscriptionEntity;

    return subscription;
  } catch (error) {
    console.error("[RAZORPAY SDK ERROR]:", JSON.stringify(error, null, 2));
    throw new Error(extractRazorpaySdkError(error));
  }
}

interface CreatedRazorpaySubscriptionEntity {
  id: string;
  plan_id: string;
  status: string;
  current_end?: number;
}
