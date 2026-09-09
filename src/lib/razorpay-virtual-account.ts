import { randomUUID } from "crypto";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { getRazorpayCredentials } from "@/lib/razorpay";

export interface RazorpayCustomer {
  id: string;
  name: string;
  contact?: string;
}

export interface ProvisionedVirtualAccountDetails {
  providerReferenceId: string;
  virtualUpiId: string | null;
  virtualAccountNumber: string | null;
  ifscCode: string | null;
  simulated: boolean;
}

interface RazorpayVirtualAccountReceiver {
  entity?: string;
  address?: string;
  account_number?: string;
  ifsc?: string;
}

interface RazorpayVirtualAccountResponse {
  id: string;
  receivers?: RazorpayVirtualAccountReceiver[];
}

function buildBasicAuth(keyId: string, keySecret: string): string {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

export function sanitizeVpaDescriptor(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 12);

  return normalized || "vendor";
}

function parseVirtualAccountResponse(
  payload: RazorpayVirtualAccountResponse
): Omit<ProvisionedVirtualAccountDetails, "simulated"> {
  const receivers = payload.receivers ?? [];
  const vpaReceiver = receivers.find((receiver) => receiver.entity === "vpa");
  const bankReceiver = receivers.find(
    (receiver) => receiver.entity === "bank_account"
  );

  return {
    providerReferenceId: payload.id,
    virtualUpiId: vpaReceiver?.address ?? null,
    virtualAccountNumber: bankReceiver?.account_number ?? null,
    ifscCode: bankReceiver?.ifsc ?? null,
  };
}

export async function createRazorpayCustomer(input: {
  name: string;
  phoneNumber: string;
  email?: string | null;
}): Promise<{ customer: RazorpayCustomer; simulated: boolean }> {
  const credentials = getRazorpayCredentials();
  const isDevelopment = isDevelopmentAppEnv();

  if (!credentials) {
    if (!isDevelopment) {
      throw new Error("Razorpay is not configured for virtual account provisioning.");
    }

    return {
      customer: {
        id: `cust_dev_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
        name: input.name,
        contact: input.phoneNumber,
      },
      simulated: true,
    };
  }

  const response = await fetch("https://api.razorpay.com/v1/customers", {
    method: "POST",
    headers: {
      Authorization: `Basic ${buildBasicAuth(credentials.keyId, credentials.keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      contact: input.phoneNumber,
      email: input.email ?? undefined,
      fail_existing: "0",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay customer creation failed: ${errorBody}`);
  }

  const customer = (await response.json()) as RazorpayCustomer;

  return {
    customer,
    simulated: false,
  };
}

export async function createRazorpayVirtualAccount(input: {
  customerId: string;
  description: string;
  vpaDescriptor: string;
}): Promise<ProvisionedVirtualAccountDetails> {
  const credentials = getRazorpayCredentials();
  const isDevelopment = isDevelopmentAppEnv();

  if (!credentials) {
    if (!isDevelopment) {
      throw new Error("Razorpay is not configured for virtual account provisioning.");
    }

    const descriptor = sanitizeVpaDescriptor(input.vpaDescriptor);

    return {
      providerReferenceId: `va_dev_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
      virtualUpiId: `recoverpe.${descriptor}@razorpay`,
      virtualAccountNumber: "1234567890123456",
      ifscCode: "RAZR0000000",
      simulated: true,
    };
  }

  const response = await fetch("https://api.razorpay.com/v1/virtual_accounts", {
    method: "POST",
    headers: {
      Authorization: `Basic ${buildBasicAuth(credentials.keyId, credentials.keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      receivers: {
        types: ["vpa", "bank_account"],
        vpa: {
          descriptor: sanitizeVpaDescriptor(input.vpaDescriptor),
        },
        bank_account: {
          descriptor: sanitizeVpaDescriptor(input.vpaDescriptor).slice(0, 10),
        },
      },
      description: input.description,
      customer_id: input.customerId,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay virtual account creation failed: ${errorBody}`);
  }

  const payload = (await response.json()) as RazorpayVirtualAccountResponse;
  const parsed = parseVirtualAccountResponse(payload);

  if (!parsed.virtualUpiId && !parsed.virtualAccountNumber) {
    throw new Error("Razorpay virtual account response did not include payment details.");
  }

  return {
    ...parsed,
    simulated: false,
  };
}

export async function provisionRazorpayVirtualAccount(input: {
  vendorName: string;
  phoneNumber: string;
  email?: string | null;
  description: string;
}): Promise<ProvisionedVirtualAccountDetails & { customerId: string }> {
  const { customer, simulated: customerSimulated } = await createRazorpayCustomer({
    name: input.vendorName,
    phoneNumber: input.phoneNumber,
    email: input.email,
  });

  const virtualAccount = await createRazorpayVirtualAccount({
    customerId: customer.id,
    description: input.description,
    vpaDescriptor: input.vendorName,
  });

  return {
    ...virtualAccount,
    customerId: customer.id,
    simulated: customerSimulated || virtualAccount.simulated,
  };
}
