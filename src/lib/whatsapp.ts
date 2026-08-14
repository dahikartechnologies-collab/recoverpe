import { formatCurrency } from "@/lib/gst";
import { generateUPIIntent } from "@/lib/upi";
import { Business, LedgerWithContact } from "@/types";

export interface WhatsAppMessageDraft {
  to: string;
  body: string;
  mode: "personal" | "business";
  ledger_id: string;
  meta_payload: WhatsAppMetaPayload;
}

export interface WhatsAppMetaPayload {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  text: {
    preview_url: boolean;
    body: string;
  };
}

export interface WhatsAppSendResult {
  success: boolean;
  simulated: boolean;
  message: string;
  draft: WhatsAppMessageDraft;
}

interface DraftMessageInput {
  ledger: LedgerWithContact;
  business: Pick<Business, "business_name"> | null;
  upiVpa: string | null;
}

function normalizeWhatsAppRecipient(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.startsWith("91") && digits.length === 12) {
    return digits;
  }

  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
}

export function draftWhatsAppReminderMessage({
  ledger,
  business,
  upiVpa,
}: DraftMessageInput): WhatsAppMessageDraft {
  const recipient = normalizeWhatsAppRecipient(ledger.contact.phone_number);
  const amountLabel = formatCurrency(ledger.balance_due);
  const isPersonal = ledger.business_id === null;

  const upiLink =
    upiVpa && ledger.balance_due > 0
      ? generateUPIIntent(
          upiVpa,
          business?.business_name ?? "Recoverpe",
          ledger.balance_due,
          ledger.invoice_number ?? ledger.id
        )
      : null;

  let body = "";

  if (isPersonal) {
    body = `Hey ${ledger.contact.name}! Just a quick reminder about the ${amountLabel} that's still pending. Let me know when you can send it over.`;

    if (upiLink) {
      body += `\n\nPay here: ${upiLink}`;
    }
  } else {
    const businessName = business?.business_name ?? "Our business";
    const invoiceLabel = ledger.invoice_number ?? ledger.id;

    body = `Dear ${ledger.contact.name},\n\nThis is a payment reminder from ${businessName} regarding Invoice ${invoiceLabel} for ${amountLabel}, due on ${ledger.due_date}.`;

    if (ledger.pdf_url) {
      body += `\n\nView invoice: ${ledger.pdf_url}`;
    }

    if (upiLink) {
      body += `\n\nPay now: ${upiLink}`;
    }

    body += "\n\nThank you.";
  }

  const meta_payload: WhatsAppMetaPayload = {
    messaging_product: "whatsapp",
    to: recipient,
    type: "text",
    text: {
      preview_url: true,
      body,
    },
  };

  return {
    to: recipient,
    body,
    mode: isPersonal ? "personal" : "business",
    ledger_id: ledger.id,
    meta_payload,
  };
}

export async function sendWhatsAppMessage(
  draft: WhatsAppMessageDraft
): Promise<WhatsAppSendResult> {
  const isDevelopment = process.env.NEXT_PUBLIC_APP_ENV === "development";

  if (isDevelopment) {
    console.log("[Recoverpe WhatsApp Dev Bypass]", {
      environment: process.env.NEXT_PUBLIC_APP_ENV,
      recipient: draft.to,
      mode: draft.mode,
      ledger_id: draft.ledger_id,
      message: draft.body,
      meta_payload: draft.meta_payload,
    });

    return {
      success: true,
      simulated: true,
      message: "WhatsApp reminder simulated in development mode.",
      draft,
    };
  }

  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "Meta WhatsApp credentials are not configured for production sending."
    );
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(draft.meta_payload),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Meta WhatsApp API failed: ${errorBody}`);
  }

  return {
    success: true,
    simulated: false,
    message: "WhatsApp reminder sent successfully.",
    draft,
  };
}
