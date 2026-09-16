import { createHash, randomUUID } from "crypto";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { getRazorpayCredentials } from "@/lib/razorpay";

export interface MerchantPayoutInput {
  businessId: string;
  businessName: string;
  payoutPan: string;
  payoutBankAccountNumber: string;
  payoutBankIfsc: string;
  payoutAccountHolderName: string;
  contactEmail: string;
  contactPhone?: string | null;
}

export interface LinkedAccountResult {
  linkedAccountId: string;
  routeStatus: "pending" | "active" | "needs_clarification";
}

export interface RouteTransferResult {
  transferId: string;
  status: string;
}

function buildBasicAuth(keyId: string, keySecret: string): string {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

function normalizePan(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeIfsc(value: string): string {
  return value.trim().toUpperCase();
}

export function validateMerchantPayoutInput(input: MerchantPayoutInput): void {
  if (!input.businessName.trim()) {
    throw new Error("Business name is required.");
  }

  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(normalizePan(input.payoutPan))) {
    throw new Error("Enter a valid PAN.");
  }

  if (!/^\d{9,18}$/.test(input.payoutBankAccountNumber.replace(/\s/g, ""))) {
    throw new Error("Enter a valid bank account number.");
  }

  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizeIfsc(input.payoutBankIfsc))) {
    throw new Error("Enter a valid IFSC code.");
  }

  if (!input.payoutAccountHolderName.trim()) {
    throw new Error("Account holder name is required.");
  }
}

export async function createRazorpayLinkedAccount(
  input: MerchantPayoutInput
): Promise<LinkedAccountResult> {
  validateMerchantPayoutInput(input);

  const credentials = getRazorpayCredentials();

  if (!credentials) {
    if (isDevelopmentAppEnv()) {
      return {
        linkedAccountId: `acc_dev_${createHash("sha256")
          .update(input.businessId)
          .digest("hex")
          .slice(0, 14)}`,
        routeStatus: "active",
      };
    }

    throw new Error("Razorpay Route is not configured.");
  }

  const accountResponse = await fetch("https://api.razorpay.com/v2/accounts", {
    method: "POST",
    headers: {
      Authorization: `Basic ${buildBasicAuth(credentials.keyId, credentials.keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.contactEmail,
      phone: input.contactPhone ?? undefined,
      type: "route",
      reference_id: `biz_${input.businessId}`,
      legal_business_name: input.businessName.trim(),
      business_type: "proprietorship",
      contact_name: input.payoutAccountHolderName.trim(),
      profile: {
        category: "services",
        subcategory: "professional_services",
        addresses: {
          registered: {
            street1: "India",
            city: "Mumbai",
            state: "MH",
            postal_code: "400001",
            country: "IN",
          },
        },
      },
      legal_info: {
        pan: normalizePan(input.payoutPan),
      },
    }),
  });

  if (!accountResponse.ok) {
    const errorBody = await accountResponse.text();
    throw new Error(`Razorpay linked account creation failed: ${errorBody}`);
  }

  const account = (await accountResponse.json()) as { id: string };

  const configResponse = await fetch(
    `https://api.razorpay.com/v2/accounts/${account.id}/products`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${buildBasicAuth(credentials.keyId, credentials.keySecret)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_name: "route",
        tnc_accepted: true,
      }),
    }
  );

  if (!configResponse.ok) {
    const errorBody = await configResponse.text();
    throw new Error(`Razorpay Route product request failed: ${errorBody}`);
  }

  const product = (await configResponse.json()) as {
    id: string;
    activation_status?: string;
  };

  const bankResponse = await fetch(
    `https://api.razorpay.com/v2/accounts/${account.id}/products/${product.id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Basic ${buildBasicAuth(credentials.keyId, credentials.keySecret)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        settlements: {
          account_number: input.payoutBankAccountNumber.replace(/\s/g, ""),
          ifsc_code: normalizeIfsc(input.payoutBankIfsc),
          beneficiary_name: input.payoutAccountHolderName.trim(),
        },
        tnc_accepted: true,
      }),
    }
  );

  if (!bankResponse.ok) {
    const errorBody = await bankResponse.text();
    throw new Error(`Razorpay Route bank configuration failed: ${errorBody}`);
  }

  const bankPayload = (await bankResponse.json()) as {
    activation_status?: string;
  };

  const activationStatus = bankPayload.activation_status ?? "pending";

  return {
    linkedAccountId: account.id,
    routeStatus:
      activationStatus === "activated"
        ? "active"
        : activationStatus === "needs_clarification"
          ? "needs_clarification"
          : "pending",
  };
}

export async function createRouteTransferForPayment(input: {
  razorpayPaymentId: string;
  linkedAccountId: string;
  amountPaise: number;
  notes?: Record<string, string>;
}): Promise<RouteTransferResult> {
  const credentials = getRazorpayCredentials();

  if (!credentials) {
    if (isDevelopmentAppEnv()) {
      return {
        transferId: `trf_dev_${randomUUID().replace(/-/g, "").slice(0, 14)}`,
        status: "processed",
      };
    }

    throw new Error("Razorpay Route is not configured.");
  }

  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${input.razorpayPaymentId}/transfers`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${buildBasicAuth(credentials.keyId, credentials.keySecret)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transfers: [
          {
            account: input.linkedAccountId,
            amount: input.amountPaise,
            currency: "INR",
            notes: input.notes ?? {},
            linked_account_notes: ["RecoverPe Smart Collect settlement"],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay Route transfer failed: ${errorBody}`);
  }

  const payload = (await response.json()) as {
    items?: Array<{ id?: string; status?: string }>;
  };

  const transfer = payload.items?.[0];

  if (!transfer?.id) {
    throw new Error("Razorpay Route transfer response missing transfer id.");
  }

  return {
    transferId: transfer.id,
    status: transfer.status ?? "created",
  };
}
