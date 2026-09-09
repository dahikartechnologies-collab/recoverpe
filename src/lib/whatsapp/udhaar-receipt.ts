import { formatCurrency } from "@/lib/gst";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import {
  buildWhatsAppTemplatePayload,
  sanitizeMetaWhatsAppRecipient,
  sendWhatsAppMessage,
  WhatsAppMessageDraft,
} from "@/lib/whatsapp";

export interface UdhaarReceiptMessageInput {
  phone: string;
  contactName: string;
  businessName: string;
  amount: number;
  outstandingBalance: number;
  ledgerId: string;
  businessId?: string | null;
}

function normalizeWhatsAppRecipient(phone: string): string {
  return sanitizeMetaWhatsAppRecipient(phone);
}

export async function computeContactOutstandingBalance(input: {
  userId: string;
  contactId: string;
  businessId: string | null;
}): Promise<number> {
  const supabase = createAdminSupabaseClient();

  let query = supabase
    .from("ledgers")
    .select("balance_due")
    .eq("user_id", input.userId)
    .eq("contact_id", input.contactId)
    .gt("balance_due", 0);

  if (input.businessId) {
    query = query.eq("business_id", input.businessId);
  } else {
    query = query.is("business_id", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to calculate outstanding balance.");
  }

  return (data ?? []).reduce(
    (sum, row) => sum + Number(row.balance_due ?? 0),
    0
  );
}

export function buildUdhaarReceiptBody(input: UdhaarReceiptMessageInput): string {
  const amountLabel = formatCurrency(input.amount);
  const balanceLabel = formatCurrency(input.outstandingBalance);

  return `Dear ${input.contactName}, a new credit entry (Udhaar) of ${amountLabel} has been added to your account. Your total outstanding balance is now ${balanceLabel}. - ${input.businessName}`;
}

export function draftUdhaarReceiptMessage(
  input: UdhaarReceiptMessageInput
): WhatsAppMessageDraft {
  const recipient = normalizeWhatsAppRecipient(input.phone);
  const body = buildUdhaarReceiptBody(input);
  const isPersonal = !input.businessId;

  return {
    to: recipient,
    body,
    mode: isPersonal ? "personal" : "business",
    ledger_id: input.ledgerId,
    meta_payload: buildWhatsAppTemplatePayload(recipient, "recoverpe_udhaar_receipt", [
      input.contactName,
      formatCurrency(input.amount),
      input.businessName,
      formatCurrency(input.outstandingBalance),
    ]),
  };
}

export async function sendUdhaarReceiptMessage(
  input: UdhaarReceiptMessageInput
): Promise<void> {
  const draft = draftUdhaarReceiptMessage(input);
  await sendWhatsAppMessage(draft, { skipCurfewCheck: true });
}

export async function fireUdhaarReceiptMessage(input: {
  userId: string;
  contactId: string;
  contactName: string;
  phone: string;
  amount: number;
  businessId: string | null;
  businessName: string;
  ledgerId: string;
}): Promise<void> {
  const outstandingBalance = await computeContactOutstandingBalance({
    userId: input.userId,
    contactId: input.contactId,
    businessId: input.businessId,
  });

  await sendUdhaarReceiptMessage({
    phone: input.phone,
    contactName: input.contactName,
    businessName: input.businessName,
    amount: input.amount,
    outstandingBalance,
    ledgerId: input.ledgerId,
    businessId: input.businessId,
  });
}
