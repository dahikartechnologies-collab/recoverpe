import { getPayPageUrl } from "@/lib/app-url";
import { formatCurrency } from "@/lib/gst";
import { sendBusinessEmail } from "@/lib/email/nodemailer";
import { buildPaymentReminderEmail } from "@/lib/email/templates";
import { isDevelopmentAppEnv } from "@/lib/app-env";

const RESEND_SANDBOX_FROM = "RecoverPe <onboarding@resend.dev>";

export interface DebtReminderEmailInput {
  to: string;
  businessName: string;
  contactName: string;
  invoiceNumber: string | null;
  amountDue: number;
  dueDate: string;
  ledgerId: string;
  smtpSettings?: Parameters<typeof sendBusinessEmail>[0]["smtpSettings"];
  unpaidInvoices?: Array<{
    invoiceNumber: string | null;
    amountDue: number;
    dueDate: string;
  }>;
}

export interface EmailDispatchResult {
  success: boolean;
  simulated: boolean;
  message: string;
  fromAddress?: string;
  providerResponse?: unknown;
  error?: string;
}

function resolveConfiguredResendFromAddress(): string | null {
  return process.env.RESEND_FROM_EMAIL?.trim() || null;
}

function isResendDomainVerificationError(status: number, body: string): boolean {
  const normalized = body.toLowerCase();

  return (
    status === 403 ||
    status === 422 ||
    (normalized.includes("domain") &&
      (normalized.includes("verify") ||
        normalized.includes("verified") ||
        normalized.includes("not found")))
  );
}

async function sendViaResendApi(input: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
  });

  const rawBody = await response.text();
  let body: unknown = rawBody;

  try {
    body = JSON.parse(rawBody);
  } catch {
    // Keep raw text for diagnostics.
  }

  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

export async function sendDebtReminderEmail(
  input: DebtReminderEmailInput
): Promise<EmailDispatchResult> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  const emailContent = buildPaymentReminderEmail({
    businessName: input.businessName,
    contactName: input.contactName,
    invoiceNumber: input.invoiceNumber,
    amountDue: input.amountDue,
    dueDate: input.dueDate,
    ledgerId: input.ledgerId,
  });

  if (resendApiKey) {
    const configuredFrom = resolveConfiguredResendFromAddress();
    const primaryFrom = configuredFrom || RESEND_SANDBOX_FROM;
    let usedFrom = primaryFrom;

    let attempt = await sendViaResendApi({
      apiKey: resendApiKey,
      from: primaryFrom,
      to: input.to,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    if (
      !attempt.ok &&
      primaryFrom !== RESEND_SANDBOX_FROM &&
      isResendDomainVerificationError(attempt.status, String(attempt.body))
    ) {
      console.warn(
        "[resend] custom from address failed; falling back to sandbox sender",
        {
          configuredFrom: primaryFrom,
          status: attempt.status,
          body: attempt.body,
        }
      );

      usedFrom = RESEND_SANDBOX_FROM;
      attempt = await sendViaResendApi({
        apiKey: resendApiKey,
        from: RESEND_SANDBOX_FROM,
        to: input.to,
        subject: emailContent.subject,
        html: emailContent.html,
      });
    }

    if (attempt.ok) {
      return {
        success: true,
        simulated: false,
        message:
          usedFrom === RESEND_SANDBOX_FROM
            ? "Email sent via Resend sandbox sender."
            : "Email sent via Resend.",
        fromAddress: usedFrom,
        providerResponse: attempt.body,
      };
    }

    return {
      success: false,
      simulated: false,
      message: "Resend email failed.",
      fromAddress: primaryFrom,
      providerResponse: attempt.body,
      error:
        typeof attempt.body === "object" &&
        attempt.body &&
        "message" in attempt.body
          ? String((attempt.body as { message?: string }).message)
          : String(attempt.body),
    };
  }

  if (input.smtpSettings) {
    const result = await sendBusinessEmail({
      smtpSettings: input.smtpSettings,
      to: input.to,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    return result;
  }

  if (isDevelopmentAppEnv()) {
    console.info("[email-dev] Debt reminder email", {
      to: input.to,
      payUrl: getPayPageUrl(input.ledgerId),
      amount: formatCurrency(input.amountDue),
    });

    return {
      success: true,
      simulated: true,
      message: "Simulated debt reminder email in development.",
    };
  }

  return {
    success: false,
    simulated: false,
    message: "Email is not configured.",
    error: "Set RESEND_API_KEY or business SMTP.",
  };
}
