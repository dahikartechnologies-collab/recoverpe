import { formatCurrency } from "@/lib/gst";
import {
  sanitizeMetaWhatsAppRecipient,
  sendWhatsAppMessage,
  WhatsAppMessageDraft,
} from "@/lib/whatsapp";

export interface AdvanceReceiptMessageInput {
  phone: string;
  contactName: string;
  businessName: string;
  amount: number;
  walletBalance: number;
  contactId: string;
  businessId?: string | null;
}

function normalizeWhatsAppRecipient(phone: string): string {
  return sanitizeMetaWhatsAppRecipient(phone);
}

export function buildAdvanceReceiptBody(input: AdvanceReceiptMessageInput): string {
  const amountLabel = formatCurrency(input.amount);
  const balanceLabel = formatCurrency(input.walletBalance);

  return `Dear ${input.contactName}, we have received your payment/advance of ${amountLabel}. Your current wallet balance is ${balanceLabel}. - ${input.businessName}`;
}

export function draftAdvanceReceiptMessage(
  input: AdvanceReceiptMessageInput
): WhatsAppMessageDraft {
  const recipient = normalizeWhatsAppRecipient(input.phone);
  const body = buildAdvanceReceiptBody(input);
  const isPersonal = !input.businessId;

  return {
    to: recipient,
    body,
    mode: isPersonal ? "personal" : "business",
    ledger_id: input.contactId,
    meta_payload: {
      messaging_product: "whatsapp",
      to: recipient,
      type: "text",
      text: { body },
    },
  };
}

export async function sendAdvanceReceiptMessage(
  input: AdvanceReceiptMessageInput
): Promise<void> {
  const draft = draftAdvanceReceiptMessage(input);
  await sendWhatsAppMessage(draft, { skipCurfewCheck: true });
}

export async function fireAdvanceReceiptMessage(
  input: AdvanceReceiptMessageInput
): Promise<void> {
  await sendAdvanceReceiptMessage(input);
}
