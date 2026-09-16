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
  error?: string;
  status?: string;
  providerPayload?: unknown;
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

function isDltComplianceError(httpStatus: number, body: string): boolean {
  const normalized = body.toLowerCase();

  return (
    httpStatus === 400 ||
    httpStatus === 403 ||
    normalized.includes("dlt") ||
    normalized.includes("pe-tm") ||
    normalized.includes("pe tm") ||
    normalized.includes("template id") ||
    normalized.includes("sender id") ||
    normalized.includes("entity id")
  );
}

function buildSmsFailureResult(input: {
  provider: "fast2sms" | "msg91";
  message: string;
  error: string;
  status: string;
  providerPayload?: unknown;
}): SmsDispatchResult {
  console.error(`[${input.provider}] SMS dispatch failed`, {
    status: input.status,
    error: input.error,
    providerPayload: input.providerPayload,
  });

  return {
    success: false,
    simulated: false,
    provider: input.provider,
    message: input.message,
    error: input.error,
    status: input.status,
    providerPayload: input.providerPayload,
  };
}

async function sendViaFast2Sms(input: SmsDispatchInput): Promise<SmsDispatchResult> {
  try {
    const apiKey = process.env.FAST2SMS_API_KEY?.trim();

    if (!apiKey) {
      return buildSmsFailureResult({
        provider: "fast2sms",
        message: "Fast2SMS is not configured.",
        error: "FAST2SMS_API_KEY is not configured.",
        status: "NOT_CONFIGURED",
      });
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

    const rawBody = await response.text();
    let payload: unknown = rawBody;

    try {
      payload = JSON.parse(rawBody) as {
        return?: boolean;
        request_id?: string;
        message?: string | string[];
      };
    } catch {
      // Keep raw text payload for diagnostics.
    }

    const payloadMessage =
      typeof payload === "object" &&
      payload &&
      "message" in payload &&
      payload.message
        ? Array.isArray(payload.message)
          ? payload.message.join(", ")
          : String(payload.message)
        : rawBody;

    if (!response.ok) {
      const dltPending = isDltComplianceError(response.status, rawBody);

      return buildSmsFailureResult({
        provider: "fast2sms",
        message: dltPending
          ? "Fast2SMS DLT compliance is pending."
          : `Fast2SMS failed with HTTP ${response.status}.`,
        error: payloadMessage,
        status: dltPending ? "DLT_PENDING" : `HTTP_${response.status}`,
        providerPayload: payload,
      });
    }

    const parsed = payload as {
      return?: boolean;
      request_id?: string;
      message?: string | string[];
    };

    if (!parsed.return) {
      const rejectionBody = JSON.stringify(parsed);
      const dltPending = isDltComplianceError(200, rejectionBody);

      return buildSmsFailureResult({
        provider: "fast2sms",
        message: dltPending
          ? "Fast2SMS DLT compliance is pending."
          : payloadMessage || "Fast2SMS rejected the message.",
        error: payloadMessage || "Fast2SMS rejected the message.",
        status: dltPending ? "DLT_PENDING" : "REJECTED",
        providerPayload: parsed,
      });
    }

    return {
      success: true,
      simulated: false,
      provider: "fast2sms",
      externalMessageId: parsed.request_id ?? null,
      message: "SMS sent via Fast2SMS.",
      providerPayload: parsed,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown Fast2SMS exception.";

    return buildSmsFailureResult({
      provider: "fast2sms",
      message: "Fast2SMS dispatch failed.",
      error: errorMessage,
      status: "EXCEPTION",
    });
  }
}

async function sendViaMsg91(input: SmsDispatchInput): Promise<SmsDispatchResult> {
  try {
    const authKey = process.env.MSG91_AUTH_KEY?.trim();
    const senderId = process.env.MSG91_SENDER_ID?.trim() || "RCVRPE";

    if (!authKey) {
      return buildSmsFailureResult({
        provider: "msg91",
        message: "MSG91 is not configured.",
        error: "MSG91_AUTH_KEY is not configured.",
        status: "NOT_CONFIGURED",
      });
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

    const rawBody = await response.text();
    let payload: unknown = rawBody;

    try {
      payload = JSON.parse(rawBody) as {
        type?: string;
        request_id?: string;
        message?: string;
      };
    } catch {
      // Keep raw text payload for diagnostics.
    }

    if (!response.ok) {
      const dltPending = isDltComplianceError(response.status, rawBody);

      return buildSmsFailureResult({
        provider: "msg91",
        message: dltPending
          ? "MSG91 DLT compliance is pending."
          : `MSG91 failed with HTTP ${response.status}.`,
        error: rawBody,
        status: dltPending ? "DLT_PENDING" : `HTTP_${response.status}`,
        providerPayload: payload,
      });
    }

    const parsed = payload as {
      type?: string;
      request_id?: string;
      message?: string;
    };

    return {
      success: true,
      simulated: false,
      provider: "msg91",
      externalMessageId: parsed.request_id ?? null,
      message: parsed.message || "SMS sent via MSG91.",
      providerPayload: parsed,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown MSG91 exception.";

    return buildSmsFailureResult({
      provider: "msg91",
      message: "MSG91 dispatch failed.",
      error: errorMessage,
      status: "EXCEPTION",
    });
  }
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
  try {
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

    return {
      success: false,
      simulated: false,
      provider: "fast2sms",
      message: "SMS provider is not configured.",
      error: "SMS provider is not configured.",
      status: "NOT_CONFIGURED",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "SMS dispatch failed.";

    console.error("[sms] unhandled dispatch exception", { error: errorMessage });

    return {
      success: false,
      simulated: false,
      provider: "fast2sms",
      message: "SMS dispatch failed.",
      error: errorMessage,
      status: "EXCEPTION",
    };
  }
}
