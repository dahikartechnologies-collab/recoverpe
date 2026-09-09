import { format } from "date-fns";
import { formatCurrency } from "@/lib/gst";
import { getPayPageUrl, FREE_TIER_WHATSAPP_WATERMARK } from "@/lib/app-url";
import { parseDateOnly } from "@/lib/timezone";
import { SubscriptionPlan } from "@/types";
import { LedgerWithContact } from "@/types";

export const AUTOPILOT_REMINDER_TEMPLATE_NAME = "recoverpe_autopilot_reminder" as const;

export interface WhatsAppReminderContentInput {
  ledger: Pick<
    LedgerWithContact,
    | "id"
    | "business_id"
    | "invoice_number"
    | "balance_due"
    | "due_date"
    | "pdf_url"
    | "contact"
  >;
  businessName: string | null;
  subscriptionPlan?: SubscriptionPlan;
  payPageUrl?: string;
  invoiceViewUrl?: string | null;
  autopilotTone?: "polite" | "firm" | "critical";
}

export function formatWhatsAppDueDate(dueDate: string): string {
  return format(parseDateOnly(dueDate), "d MMM yyyy");
}

export function buildAutopilotReminderTemplateParameters(input: {
  ledger: Pick<
    LedgerWithContact,
    "id" | "invoice_number" | "balance_due" | "due_date" | "contact"
  >;
  businessName: string | null;
}): string[] {
  return [
    input.ledger.contact.name,
    input.businessName ?? "Our business",
    input.ledger.invoice_number ?? input.ledger.id,
    formatCurrency(input.ledger.balance_due),
    formatWhatsAppDueDate(input.ledger.due_date),
  ];
}

export function appendFreeTierWatermark(
  body: string,
  subscriptionPlan: SubscriptionPlan = "free"
): string {
  if (subscriptionPlan === "premium") {
    return body;
  }

  return `${body}\n\n${FREE_TIER_WHATSAPP_WATERMARK}`;
}

export function buildWhatsAppReminderBody({
  ledger,
  businessName,
  subscriptionPlan = "free",
  payPageUrl = getPayPageUrl(ledger.id),
  invoiceViewUrl = null,
  autopilotTone,
}: WhatsAppReminderContentInput): string {
  const amountLabel = formatCurrency(ledger.balance_due);
  const isPersonal = ledger.business_id === null;

  let body = "";

  if (autopilotTone === "firm") {
    body = `Important: `;
  } else if (autopilotTone === "critical") {
    body = `Final notice: `;
  }

  if (isPersonal) {
    body += `Hey ${ledger.contact.name}! Just a quick reminder about the ${amountLabel} that's still pending. Let me know when you can send it over.`;
    body += `\n\nPay securely here: ${payPageUrl}`;
  } else {
    const businessLabel = businessName ?? "Our business";
    const invoiceLabel = ledger.invoice_number ?? ledger.id;

    if (autopilotTone === "polite" || !autopilotTone) {
      body += `Dear ${ledger.contact.name},\n\nThis is a payment reminder from ${businessLabel} regarding Invoice ${invoiceLabel} for ${amountLabel}, due on ${ledger.due_date}.`;
    } else if (autopilotTone === "firm") {
      body += `Dear ${ledger.contact.name},\n\nThis is a follow-up from ${businessLabel} regarding overdue Invoice ${invoiceLabel} for ${amountLabel} (due ${ledger.due_date}). Please arrange payment at your earliest convenience.`;
    } else {
      body += `Dear ${ledger.contact.name},\n\nThis is a final automated reminder from ${businessLabel} for Invoice ${invoiceLabel}. Outstanding balance: ${amountLabel} (due ${ledger.due_date}). Immediate settlement is required to avoid escalation.`;
    }

    if (invoiceViewUrl) {
      body += `\n\nView invoice: ${invoiceViewUrl}`;
    }

    body += `\n\nPay securely here: ${payPageUrl}`;
    body += "\n\nThank you.";
  }

  return appendFreeTierWatermark(body, subscriptionPlan);
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash_manual: "Cash",
  bank_transfer: "Bank Transfer",
};

export function formatOfflinePaymentMethodLabel(paymentMethod: string): string {
  return PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod;
}

export function buildCourtesyPaymentClearBody(
  amount: number,
  paymentMethod: string
): string {
  const amountLabel = formatCurrency(amount);
  const methodLabel = formatOfflinePaymentMethodLabel(paymentMethod);

  return `Payment of ${amountLabel} received via ${methodLabel}. Your ledger is now clear.`;
}

export function buildSmartCollectPaymentReceiptBody(
  amountReceived: number,
  netOutstanding: number
): string {
  const receivedLabel = formatCurrency(amountReceived);
  const outstandingLabel = formatCurrency(netOutstanding);

  if (netOutstanding <= 0) {
    return `Payment of ${receivedLabel} received via Smart Collect. Your account is now fully settled. Thank you.`;
  }

  return `Payment of ${receivedLabel} received via Smart Collect. Your updated outstanding balance is ${outstandingLabel}. Thank you.`;
}
