/**
 * Fast2SMS route guard — single place for outbound SMS routing.
 *
 * Login/registration OTPs MUST use Firebase Client Phone Auth only.
 * Fast2SMS is reserved for transactional alerts (DLT) and server-side OTP alerts.
 *
 * Never defaults to generic route "q".
 */

export interface SmsDltVariables {
  amount: string;
  businessName: string;
  payUrl: string;
}

export type Fast2SmsRoute = "dlt" | "otp";

export interface Fast2SmsOtpDispatch {
  intent: "otp";
  phoneNumber: string;
  otpCode: string;
}

export interface Fast2SmsDltDispatch {
  intent: "dlt";
  phoneNumber: string;
  dltVariables: SmsDltVariables;
}

export type Fast2SmsDispatch = Fast2SmsOtpDispatch | Fast2SmsDltDispatch;

export function normalizeIndianMobile(value: string): string {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return digits;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }

  throw new Error("Enter a valid 10-digit mobile number for SMS.");
}

function sanitizeDltVariable(value: string, maxLength = 30): string {
  return value.replace(/\|/g, "/").trim().slice(0, maxLength);
}

export function buildFast2SmsRequest(
  input: Fast2SmsDispatch
): { body: Record<string, string>; route: Fast2SmsRoute } | { error: string } {
  const numbers = normalizeIndianMobile(input.phoneNumber);

  if (input.intent === "otp") {
    const otpCode = input.otpCode.replace(/\D/g, "");

    if (otpCode.length !== 6) {
      return { error: "OTP SMS requires a 6-digit numeric code." };
    }

    return {
      route: "otp",
      body: {
        route: "otp",
        variables_values: otpCode,
        numbers,
      },
    };
  }

  const dltTemplateId = process.env.FAST2SMS_DLT_TEMPLATE_ID?.trim();
  const senderId = process.env.FAST2SMS_SENDER_ID?.trim();

  if (!dltTemplateId) {
    return {
      error:
        "FAST2SMS_DLT_TEMPLATE_ID is not configured. Generic route 'q' is disallowed.",
    };
  }

  if (!senderId) {
    return { error: "FAST2SMS_SENDER_ID is not configured." };
  }

  return {
    route: "dlt",
    body: {
      route: "dlt",
      sender_id: senderId,
      message: dltTemplateId,
      variables_values: [
        sanitizeDltVariable(input.dltVariables.amount, 12),
        sanitizeDltVariable(input.dltVariables.businessName, 30),
        sanitizeDltVariable(input.dltVariables.payUrl, 120),
      ].join("|"),
      numbers,
    },
  };
}

export async function postFast2SmsRequest(input: {
  apiKey: string;
  body: Record<string, string>;
}): Promise<{ ok: boolean; status: number; rawBody: string; payload: unknown }> {
  const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
    method: "POST",
    headers: {
      authorization: input.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.body),
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

  return {
    ok: response.ok,
    status: response.status,
    rawBody,
    payload,
  };
}
