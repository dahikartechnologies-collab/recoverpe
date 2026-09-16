import { getPayPageUrl } from "@/lib/app-url";
import { formatCurrency } from "@/lib/gst";
import { sendBusinessEmail } from "@/lib/email/nodemailer";
import { buildPaymentReminderEmail } from "@/lib/email/templates";
import { isDevelopmentAppEnv } from "@/lib/app-env";

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

export async function sendDebtReminderEmail(
  input: DebtReminderEmailInput
): Promise<{ success: boolean; simulated: boolean; message: string }> {
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
    const fromAddress =
      process.env.RESEND_FROM_EMAIL?.trim() || "RecoverPe <billing@recoverpe.in>";

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [input.to],
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Resend email failed: ${errorBody}`);
    }

    return {
      success: true,
      simulated: false,
      message: "Email sent via Resend.",
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

  throw new Error("Email is not configured. Set RESEND_API_KEY or business SMTP.");
}
