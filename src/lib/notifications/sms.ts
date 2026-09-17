import { isDevelopmentAppEnv } from "@/lib/app-env";
import {
  buildFast2SmsRequest,
  normalizeIndianMobile,
  postFast2SmsRequest,
  type SmsDltVariables,
} from "@/lib/sms";

export type { SmsDltVariables } from "@/lib/sms";

export interface SmsDispatchInput {
  phoneNumber: string;
  message: string;
  dltVariables?: SmsDltVariables;
  /** Server-side OTP alerts only — never used for login/registration. */
  otpCode?: string;
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
  route?: "dlt" | "otp" | "msg91";
}

function formatSmsAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function isDltComplianceError(httpStatus: number, body: string): boolean {
  const normalized = body.toLowerCase();

  return (
    (httpStatus === 403 &&
      (normalized.includes("dlt") ||
        normalized.includes("pe-tm") ||
        normalized.includes("template id") ||
        normalized.includes("sender id") ||
        normalized.includes("entity id"))) ||
    normalized.includes("dlt pending") ||
    normalized.includes("pe-tm chain")
  );
}

function isDltFormattingError(httpStatus: number, body: string): boolean {
  const normalized = body.toLowerCase();

  return (
    httpStatus === 400 ||
    normalized.includes("variable") ||
    normalized.includes("format") ||
    normalized.includes("invalid template") ||
    normalized.includes("message id")
  );
}

function buildSmsFailureResult(input: {
  provider: "fast2sms" | "msg91";
  message: string;
  error: string;
  status: string;
  providerPayload?: unknown;
  route?: SmsDispatchResult["route"];
}): SmsDispatchResult {
  console.error(`[${input.provider}] SMS dispatch failed`, {
    status: input.status,
    error: input.error,
    route: input.route,
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
    route: input.route,
  };
}

function extractPayloadMessage(payload: unknown, rawBody: string): string {
  if (
    typeof payload === "object" &&
    payload &&
    "message" in payload &&
    payload.message
  ) {
    return Array.isArray(payload.message)
      ? payload.message.join(", ")
      : String(payload.message);
  }

  return rawBody;
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

    const otpCode = input.otpCode?.trim();
    const dltTemplateId = process.env.FAST2SMS_DLT_TEMPLATE_ID?.trim();

    let dispatchRequest;

    if (otpCode) {
      dispatchRequest = buildFast2SmsRequest({
        intent: "otp",
        phoneNumber: input.phoneNumber,
        otpCode,
      });
    } else if (input.dltVariables) {
      dispatchRequest = buildFast2SmsRequest({
        intent: "dlt",
        phoneNumber: input.phoneNumber,
        dltVariables: input.dltVariables,
      });
    } else if (dltTemplateId) {
      return buildSmsFailureResult({
        provider: "fast2sms",
        message: "Fast2SMS DLT template variables are required.",
        error:
          "DLT variables missing while FAST2SMS_DLT_TEMPLATE_ID is configured. Generic route 'q' is disallowed.",
        status: "INVALID_ROUTE",
        route: "dlt",
      });
    } else {
      return buildSmsFailureResult({
        provider: "fast2sms",
        message: "SMS route could not be determined.",
        error:
          "Provide DLT variables or an OTP code. Generic route 'q' is disallowed.",
        status: "INVALID_ROUTE",
      });
    }

    if ("error" in dispatchRequest) {
      return buildSmsFailureResult({
        provider: "fast2sms",
        message: "Fast2SMS route guard rejected the request.",
        error: dispatchRequest.error,
        status: "INVALID_ROUTE",
        route: otpCode ? "otp" : "dlt",
      });
    }

    const { body, route } = dispatchRequest;
    const { ok, status, rawBody, payload } = await postFast2SmsRequest({
      apiKey,
      body,
    });

    const payloadMessage = extractPayloadMessage(payload, rawBody);

    if (!ok) {
      const dltPending = isDltComplianceError(status, rawBody);
      const formattingError = isDltFormattingError(status, rawBody);

      return buildSmsFailureResult({
        provider: "fast2sms",
        message: dltPending
          ? "Fast2SMS DLT compliance is pending."
          : formattingError
            ? "Fast2SMS DLT template formatting error."
            : `Fast2SMS failed with HTTP ${status}.`,
        error: payloadMessage,
        status: dltPending
          ? "DLT_PENDING"
          : formattingError
            ? "DLT_FORMAT_ERROR"
            : `HTTP_${status}`,
        providerPayload: payload,
        route,
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
      const formattingError = isDltFormattingError(200, rejectionBody);

      return buildSmsFailureResult({
        provider: "fast2sms",
        message: dltPending
          ? "Fast2SMS DLT compliance is pending."
          : formattingError
            ? "Fast2SMS DLT template formatting error."
            : payloadMessage || "Fast2SMS rejected the message.",
        error: payloadMessage || "Fast2SMS rejected the message.",
        status: dltPending
          ? "DLT_PENDING"
          : formattingError
            ? "DLT_FORMAT_ERROR"
            : "REJECTED",
        providerPayload: parsed,
        route,
      });
    }

    return {
      success: true,
      simulated: false,
      provider: "fast2sms",
      externalMessageId: parsed.request_id ?? null,
      message:
        route === "dlt"
          ? "SMS sent via Fast2SMS DLT template."
          : "SMS sent via Fast2SMS OTP route.",
      providerPayload: parsed,
      route,
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
        route: "msg91",
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
        route: "msg91",
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
      route: "msg91",
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown MSG91 exception.";

    return buildSmsFailureResult({
      provider: "msg91",
      message: "MSG91 dispatch failed.",
      error: errorMessage,
      status: "EXCEPTION",
      route: "msg91",
    });
  }
}

export function buildDebtReminderSmsDltVariables(input: {
  amount: number;
  businessName: string;
  payUrl: string;
}): SmsDltVariables {
  return {
    amount: formatSmsAmount(input.amount),
    businessName: input.businessName,
    payUrl: input.payUrl,
  };
}

export function buildDebtReminderSmsMessage(input: {
  amount: number;
  businessName: string;
  payUrl: string;
}): string {
  const amountLabel = formatSmsAmount(input.amount);

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
        route: input.otpCode ? "otp" : input.dltVariables ? "dlt" : undefined,
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

export async function sendOtpAlertSms(input: {
  phoneNumber: string;
  otpCode: string;
}): Promise<SmsDispatchResult> {
  return sendTransactionalSms({
    phoneNumber: input.phoneNumber,
    message: `Your RecoverPe verification code is ${input.otpCode}.`,
    otpCode: input.otpCode,
  });
}
