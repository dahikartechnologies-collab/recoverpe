import { formatCurrency } from "@/lib/gst";
import { getPayPageUrl } from "@/lib/app-url";

const BRAND_NAVY = "#1E3A8A";
const BRAND_TEAL = "#0F766E";
const TEXT_MUTED = "#64748B";
const BORDER = "#E2E8F0";

function emailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F8FAFC;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px 8px;">
              <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND_TEAL};font-weight:600;">Recoverpe</p>
              <h1 style="margin:12px 0 0;font-size:22px;line-height:1.3;color:${BRAND_NAVY};">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;font-size:15px;line-height:1.6;color:#334155;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid ${BORDER};font-size:12px;color:${TEXT_MUTED};">
              Sent securely via your Recoverpe business mailbox.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, href: string): string {
  return `<p style="margin:24px 0 0;">
    <a href="${href}" style="display:inline-block;background:${BRAND_NAVY};color:#FFFFFF;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px;">${label}</a>
  </p>`;
}

function summaryRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BORDER};color:${TEXT_MUTED};font-size:14px;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid ${BORDER};text-align:right;font-weight:600;font-size:14px;">${value}</td>
  </tr>`;
}

export interface PaymentReminderEmailInput {
  businessName: string;
  contactName: string;
  invoiceNumber: string | null;
  amountDue: number;
  dueDate: string;
  ledgerId: string;
  invoiceViewUrl?: string | null;
}

export function buildPaymentReminderEmail(input: PaymentReminderEmailInput): {
  subject: string;
  html: string;
} {
  const amountLabel = formatCurrency(input.amountDue);
  const invoiceRef = input.invoiceNumber ?? input.ledgerId.slice(0, 8).toUpperCase();
  const payUrl = getPayPageUrl(input.ledgerId);

  const bodyHtml = `
    <p style="margin:0 0 16px;">Dear ${input.contactName},</p>
    <p style="margin:0 0 20px;">This is a payment reminder from <strong>${input.businessName}</strong> regarding your outstanding invoice.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 8px;">
      ${summaryRow("Invoice", invoiceRef)}
      ${summaryRow("Amount due", amountLabel)}
      ${summaryRow("Due date", input.dueDate)}
    </table>
    ${
      input.invoiceViewUrl
        ? `<p style="margin:16px 0 0;"><a href="${input.invoiceViewUrl}" style="color:${BRAND_TEAL};">View invoice document</a></p>`
        : ""
    }
    ${ctaButton("View & Pay", payUrl)}
    <p style="margin:20px 0 0;color:${TEXT_MUTED};font-size:13px;">If you have already paid, please disregard this message.</p>
  `;

  return {
    subject: `Payment reminder — ${amountLabel} due from ${input.businessName}`,
    html: emailShell("Payment Reminder", bodyHtml),
  };
}

export interface LegalNoticeEmailInput {
  businessName: string;
  contactName: string;
  amountDue: number;
  invoiceNumber: string | null;
  ledgerId: string;
  legalNoticeUrl: string;
}

export function buildLegalNoticeEmail(input: LegalNoticeEmailInput): {
  subject: string;
  html: string;
} {
  const amountLabel = formatCurrency(input.amountDue);
  const invoiceRef = input.invoiceNumber ?? input.ledgerId.slice(0, 8).toUpperCase();
  const payUrl = getPayPageUrl(input.ledgerId);

  const bodyHtml = `
    <p style="margin:0 0 16px;">Dear ${input.contactName},</p>
    <p style="margin:0 0 16px;">Please find a formal demand notice from <strong>${input.businessName}</strong> regarding overdue dues of <strong>${amountLabel}</strong>.</p>
    <p style="margin:0 0 16px;">Invoice reference: <strong>${invoiceRef}</strong>. You are required to settle the outstanding amount within 7 days of this notice.</p>
    <p style="margin:0 0 8px;"><a href="${input.legalNoticeUrl}" style="color:${BRAND_TEAL};font-weight:600;">Download legal notice PDF</a></p>
    ${ctaButton("View Pay Link", payUrl)}
    <p style="margin:20px 0 0;color:${TEXT_MUTED};font-size:13px;">Issued via Recoverpe Legal Desk on behalf of ${input.businessName}.</p>
  `;

  return {
    subject: `Formal legal notice — ${input.businessName}`,
    html: emailShell("Legal Notice", bodyHtml),
  };
}

export function buildSmtpTestEmail(input: {
  businessName: string;
  recipientEmail: string;
}): { subject: string; html: string } {
  const bodyHtml = `
    <p style="margin:0 0 16px;">Your Recoverpe outbound email configuration is working.</p>
    <p style="margin:0;">This test message was sent from <strong>${input.businessName}</strong> to <strong>${input.recipientEmail}</strong> using your custom SMTP settings.</p>
  `;

  return {
    subject: `Recoverpe SMTP test — ${input.businessName}`,
    html: emailShell("SMTP Test Successful", bodyHtml),
  };
}
