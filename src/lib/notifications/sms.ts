import { isDevelopmentAppEnv } from "@/lib/app-env";

export interface SmsDispatchInput {
  phoneNumber: string;
  message: string;
}

export interface SmsDispatchResult {
  success: boolean;
  simulated: boolean;
  provider: "fast2sms" | "msg91" | "simulated";
  externalMessageId?: string | null;
  message: string;
}

function normalizeIndianMobile(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return digits;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }

  throw new Error("Enter a valid 10-digit mobile number for SMS.");
}

async function sendViaFast2Sms(input: SmsDispatchInput): Promise<SmsDispatchResult> {
  const apiKey = process.env.FAST2SMS_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("FAST2SMS_API_KEY is not configured.");
  }

  const numbers = normalizeIndianMobile(input.phoneNumber);
  const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      route: "q",
      message: input.message,
      language: "english",
      numbers,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Fast2SMS failed: ${errorBody}`);
  }

  const payload = (await response.json()) as {
    return?: boolean;
    request_id?: string;
    message?: string;
  };

  if (!payload.return) {
    throw new Error(payload.message || "Fast2SMS rejected the message.");
  }

  return {
    success: true,
    simulated: false,
    provider: "fast2sms",
    externalMessageId: payload.request_id ?? null,
    message: "SMS sent via Fast2SMS.",
  };
}

async function sendViaMsg91(input: SmsDispatchInput): Promise<SmsDispatchResult> {
  const authKey = process.env.MSG91_AUTH_KEY?.trim();
  const senderId = process.env.MSG91_SENDER_ID?.trim() || "RCVRPE";

  if (!authKey) {
    throw new Error("MSG91_AUTH_KEY is not configured.");
  }

  const mobile = normalizeIndianMobile(input.phoneNumber);
  const response = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: {
      authkey: authKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: process.env.MSG91_TEMPLATE_ID?.trim() || undefined,
      sender: senderId,
      short_url: "0",
      mobiles: `91${mobile}`,
      message: input.message,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`MSG91 failed: ${errorBody}`);
  }

  const payload = (await response.json()) as {
    type?: string;
    request_id?: string;
    message?: string;
  };

  return {
    success: true,
    simulated: false,
    provider: "msg91",
    externalMessageId: payload.request_id ?? null,
    message: payload.message || "SMS sent via MSG91.",
  };
}

export function buildDebtReminderSmsMessage(input: {
  amount: number;
  businessName: string;
  payUrl: string;
}): string {
  const amountLabel = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(input.amount);

  return `Dear Customer, payment of ${amountLabel} for ${input.businessName} is pending. Pay instantly at: ${input.payUrl} - RecoverPe`;
}

export async function sendTransactionalSms(
  input: SmsDispatchInput
): Promise<SmsDispatchResult> {
  const provider = process.env.SMS_PROVIDER?.trim().toLowerCase() || "fast2sms";

  if (provider === "msg91") {
    return sendViaMsg91(input);
  }

  if (provider === "fast2sms" && process.env.FAST2SMS_API_KEY?.trim()) {
    return sendViaFast2Sms(input);
  }

  if (process.env.MSG91_AUTH_KEY?.trim()) {
    return sendViaMsg91(input);
  }

  if (isDevelopmentAppEnv()) {
    console.info("[sms-dev]", input);
    return {
      success: true,
      simulated: true,
      provider: "simulated",
      message: "Simulated SMS in development.",
    };
  }

  throw new Error("SMS provider is not configured.");
}
