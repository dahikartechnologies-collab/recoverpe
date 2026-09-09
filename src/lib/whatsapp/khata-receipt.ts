import { formatCurrency } from "@/lib/gst";
import { fetchPublicKhataPaymentDetails } from "@/lib/khata-qr";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { generateKhataUpiIntent } from "@/lib/upi";
import {
  sendWhatsAppMessage,
  WhatsAppMessageDraft,
} from "@/lib/whatsapp";

export interface KhataReceiptMessageInput {
  phone: string;
  customerName: string;
  businessName: string;
  amount: number;
  newBalance: number;
  upiLink?: string | null;
  ledgerId: string;
  businessId?: string | null;
}

export function formatE164IndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("91") && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (phone.trim().startsWith("+")) {
    return `+${digits}`;
  }

  return digits.length > 0 ? `+${digits}` : phone.trim();
}

function normalizeWhatsAppRecipient(phone: string): string {
  const e164 = formatE164IndianPhone(phone);

  return e164.replace(/\D/g, "");
}

export function buildKhataReceiptBody(input: KhataReceiptMessageInput): string {
  const amountLabel = formatCurrency(input.amount);
  const balanceLabel = formatCurrency(input.newBalance);

  let body = `Hi ${input.customerName}, your Khata entry of ${amountLabel} at ${input.businessName} has been recorded. Your total outstanding balance is ${balanceLabel}.`;

  if (input.upiLink?.trim()) {
    body += `\n\nTo pay instantly, click here: ${input.upiLink.trim()}`;
  }

  body += "\n\nPowered by Recoverpe.";

  return body;
}

export function draftKhataReceiptMessage(
  input: KhataReceiptMessageInput
): WhatsAppMessageDraft {
  const recipient = normalizeWhatsAppRecipient(input.phone);
  const body = buildKhataReceiptBody(input);

  return {
    to: recipient,
    body,
    mode: input.businessId ? "business" : "personal",
    ledger_id: input.ledgerId,
    meta_payload: {
      messaging_product: "whatsapp",
      to: recipient,
      type: "text",
      text: { body },
    },
  };
}

export async function sendKhataReceiptMessage(
  input: KhataReceiptMessageInput
): Promise<void> {
  const draft = draftKhataReceiptMessage(input);

  await sendWhatsAppMessage(draft, { skipCurfewCheck: true });
}

export async function computeContactOutstandingBalance(input: {
  userId: string;
  contactId: string;
  businessId: string;
}): Promise<number> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("ledgers")
    .select("balance_due")
    .eq("user_id", input.userId)
    .eq("contact_id", input.contactId)
    .eq("business_id", input.businessId)
    .gt("balance_due", 0);

  if (error) {
    throw new Error(error.message || "Failed to calculate outstanding balance.");
  }

  return (data ?? []).reduce(
    (sum, row) => sum + Number(row.balance_due ?? 0),
    0
  );
}

export function fireKhataReceiptMessage(input: {
  userId: string;
  contactId: string;
  businessId: string;
  businessName: string;
  customerName: string;
  phone: string;
  amount: number;
  ledgerId: string;
  upiLink?: string | null;
  resolveUpiLink?: boolean;
}): void {
  void (async () => {
    try {
      const newBalance = await computeContactOutstandingBalance({
        userId: input.userId,
        contactId: input.contactId,
        businessId: input.businessId,
      });

      let upiLink = input.upiLink ?? null;

      if (!upiLink && input.resolveUpiLink) {
        const payment = await fetchPublicKhataPaymentDetails(input.businessId);

        if (payment?.virtual_upi_id && input.amount > 0) {
          upiLink = generateKhataUpiIntent(
            payment.virtual_upi_id,
            payment.payee_name,
            input.amount
          );
        }
      }

      await sendKhataReceiptMessage({
        phone: input.phone,
        customerName: input.customerName,
        businessName: input.businessName,
        amount: input.amount,
        newBalance,
        upiLink,
        ledgerId: input.ledgerId,
        businessId: input.businessId,
      });
    } catch (error) {
      console.error("[khata-receipt] Failed to send WhatsApp receipt:", error);
    }
  })();
}
