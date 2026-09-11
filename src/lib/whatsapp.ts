import { getPayPageUrl } from "@/lib/app-url";
import { formatDisplayInvoice } from "@/lib/invoice-display";
import { getTraiCurfewMessage, isTraiCurfewActive } from "@/lib/trai-curfew";
import {
  buildAutopilotReminderTemplateParameters,
  buildCourtesyPaymentClearBody,
  buildSmartCollectPaymentReceiptBody,
  buildWhatsAppReminderBody,
} from "@/lib/whatsapp-content";
import { Business, LedgerWithContact, SubscriptionPlan } from "@/types";

export interface WhatsAppMessageDraft {
  to: string;
  body: string;
  mode: "personal" | "business";
  ledger_id: string;
  meta_payload: WhatsAppOutboundPayload;
}

export type WhatsAppOutboundPayload =
  | WhatsAppMetaPayload
  | WhatsAppTextMetaPayload
  | WhatsAppTemplateMetaPayload;

export type RecoverpeWhatsAppTemplateName =
  | "recoverpe_udhaar_receipt"
  | "recoverpe_jama_receipt"
  | "recoverpe_autopilot_reminder";

export interface WhatsAppTemplateTextParameter {
  type: "text";
  text: string;
}

export interface WhatsAppTemplateMetaPayload {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "template";
  template: {
    name: RecoverpeWhatsAppTemplateName;
    language: { code: string };
    components: Array<{
      type: "body";
      parameters: WhatsAppTemplateTextParameter[];
    }>;
  };
}

export const META_WHATSAPP_TEMPLATE_LANGUAGE = "en";

export interface WhatsAppTextMetaPayload {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  text: {
    body: string;
  };
}

export interface WhatsAppSendOptions {
  skipCurfewCheck?: boolean;
}

export class TraiCurfewError extends Error {
  constructor() {
    super(getTraiCurfewMessage());
    this.name = "TraiCurfewError";
  }
}

export interface WhatsAppInteractiveButton {
  type: "reply";
  reply: {
    id: string;
    title: string;
  };
}

export interface WhatsAppMetaPayload {
  messaging_product: "whatsapp";
  to: string;
  type: "interactive";
  interactive: WhatsAppInteractiveMessage;
}

export interface WhatsAppInteractiveMessage {
  type: "button" | "cta_url";
  header?: {
    type: "document";
    document: {
      link: string;
      filename: string;
    };
  };
  body: {
    text: string;
  };
  action: WhatsAppInteractiveAction;
}

export type WhatsAppInteractiveAction =
  | {
      name: "cta_url";
      parameters: {
        display_text: string;
        url: string;
      };
    }
  | {
      buttons: WhatsAppInteractiveButton[];
    };

export interface WhatsAppSendResult {
  success: boolean;
  simulated: boolean;
  message: string;
  draft: WhatsAppMessageDraft;
}

interface DraftMessageInput {
  ledger: LedgerWithContact;
  business: Pick<Business, "business_name"> | null;
  subscriptionPlan?: SubscriptionPlan;
}

function normalizeWhatsAppRecipient(phoneNumber: string): string {
  return sanitizeMetaWhatsAppRecipient(phoneNumber);
}

/** Meta requires E.164 digits only, e.g. 919888664667 for Indian mobiles. */
export function sanitizeMetaWhatsAppRecipient(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (digits.startsWith("91")) {
    return digits;
  }

  return digits;
}

function withSanitizedRecipient(draft: WhatsAppMessageDraft): WhatsAppMessageDraft {
  const recipient = sanitizeMetaWhatsAppRecipient(draft.to);

  return {
    ...draft,
    to: recipient,
    meta_payload: {
      ...draft.meta_payload,
      to: recipient,
    },
  };
}

export function buildWhatsAppTemplatePayload(
  recipient: string,
  templateName: RecoverpeWhatsAppTemplateName,
  parameters: string[]
): WhatsAppTemplateMetaPayload {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "template",
    template: {
      name: templateName,
      language: { code: META_WHATSAPP_TEMPLATE_LANGUAGE },
      components: [
        {
          type: "body",
          parameters: parameters.map((text) => ({ type: "text", text })),
        },
      ],
    },
  };
}

export function draftWhatsAppReminderMessage({
  ledger,
  business,
  subscriptionPlan = "free",
  invoiceDocumentLink = null,
  autopilotTone,
  totalOutstandingBalance,
}: DraftMessageInput & {
  invoiceDocumentLink?: string | null;
  autopilotTone?: "polite" | "firm" | "critical";
  totalOutstandingBalance?: number;
}): WhatsAppMessageDraft {
  const recipient = normalizeWhatsAppRecipient(ledger.contact.phone_number);
  const payPageUrl = getPayPageUrl(ledger.id);
  const body = buildWhatsAppReminderBody({
    ledger,
    businessName: business?.business_name ?? null,
    subscriptionPlan,
    payPageUrl,
    invoiceViewUrl: invoiceDocumentLink,
    autopilotTone,
  });
  const isPersonal = ledger.business_id === null;

  const meta_payload = buildWhatsAppTemplatePayload(
    recipient,
    "recoverpe_autopilot_reminder",
    buildAutopilotReminderTemplateParameters({
      ledger,
      businessName: business?.business_name ?? null,
      amountDue: totalOutstandingBalance,
    })
  );

  return {
    to: recipient,
    body,
    mode: isPersonal ? "personal" : "business",
    ledger_id: ledger.id,
    meta_payload,
  };
}

export function draftCourtesyPaymentClearMessage(
  ledger: LedgerWithContact,
  amount: number,
  paymentMethod: string
): WhatsAppMessageDraft {
  const recipient = normalizeWhatsAppRecipient(ledger.contact.phone_number);
  const body = buildCourtesyPaymentClearBody(amount, paymentMethod);
  const isPersonal = ledger.business_id === null;

  return {
    to: recipient,
    body,
    mode: isPersonal ? "personal" : "business",
    ledger_id: ledger.id,
    meta_payload: {
      messaging_product: "whatsapp",
      to: recipient,
      type: "text",
      text: { body },
    },
  };
}

export function draftSmartCollectPaymentReceiptMessage(input: {
  contactName: string;
  phoneNumber: string;
  amountReceived: number;
  netOutstanding: number;
  ledgerId: string;
  businessId: string | null;
}): WhatsAppMessageDraft {
  const recipient = normalizeWhatsAppRecipient(input.phoneNumber);
  const body = buildSmartCollectPaymentReceiptBody(
    input.amountReceived,
    input.netOutstanding
  );
  const isPersonal = input.businessId === null;

  return {
    to: recipient,
    body,
    mode: isPersonal ? "personal" : "business",
    ledger_id: input.ledgerId,
    meta_payload: {
      messaging_product: "whatsapp",
      to: recipient,
      type: "text",
      text: { body },
    },
  };
}

export function draftLegalNoticeWhatsAppMessage({
  ledger,
  businessName,
  legalNoticePdfUrl,
}: {
  ledger: LedgerWithContact;
  businessName: string | null;
  legalNoticePdfUrl: string;
}): WhatsAppMessageDraft {
  const recipient = normalizeWhatsAppRecipient(ledger.contact.phone_number);
  const issuer = businessName ?? "Recoverpe user";
  const body = [
    `Formal Legal Notice — ${issuer}`,
    "",
    `Dear ${ledger.contact.name},`,
    "",
    `Please find attached a formal demand notice regarding overdue dues of INR ${ledger.balance_due.toLocaleString("en-IN")}.`,
    ledger.invoice_number
      ? `Invoice reference: ${ledger.invoice_number}.`
      : "",
    "",
    "You are required to settle the outstanding amount within 7 days of this notice.",
    "",
    "— Issued via Recoverpe Legal Desk",
  ]
    .filter(Boolean)
    .join("\n");

  const isPersonal = ledger.business_id === null;

  const meta_payload: WhatsAppMetaPayload = {
    messaging_product: "whatsapp",
    to: recipient,
    type: "interactive",
    interactive: {
      type: "cta_url",
      header: {
        type: "document",
        document: {
          link: legalNoticePdfUrl,
          filename: `Legal-Notice-${formatDisplayInvoice(ledger)}.pdf`,
        },
      },
      body: { text: body },
      action: {
        name: "cta_url",
        parameters: {
          display_text: "View Pay Link",
          url: getPayPageUrl(ledger.id),
        },
      },
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
  incomingDraft: WhatsAppMessageDraft,
  options: WhatsAppSendOptions = {}
): Promise<WhatsAppSendResult> {
  const draft = withSanitizedRecipient(incomingDraft);
  console.log("[WHATSAPP DISPATCHER] Triggered for:", draft.to);

  if (!options.skipCurfewCheck && isTraiCurfewActive()) {
    console.log("[WHATSAPP] Blocked by TRAI curfew window.");
    throw new TraiCurfewError();
  }

  const forceReal = process.env.TEST_REAL_WHATSAPP_LOCALLY === "true";
  const isDev = process.env.APP_ENV === "development";

  console.log("[WHATSAPP] Execution guard:", {
    APP_ENV: process.env.APP_ENV ?? null,
    TEST_REAL_WHATSAPP_LOCALLY: process.env.TEST_REAL_WHATSAPP_LOCALLY ?? null,
    forceReal,
    isDev,
    willMock: isDev && !forceReal,
  });

  if (isDev && !forceReal) {
    console.log(
      "[WHATSAPP] Mocking message in dev mode (TEST_REAL_WHATSAPP_LOCALLY is false)."
    );

    return {
      success: true,
      simulated: true,
      message: "WhatsApp reminder simulated in development mode.",
      draft,
    };
  }

  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();

  console.log("[WHATSAPP] Meta credential check:", {
    phoneNumberIdPresent: Boolean(phoneNumberId),
    accessTokenPresent: Boolean(accessToken),
    recipient: draft.to,
    mode: draft.mode,
    ledger_id: draft.ledger_id,
  });

  if (!phoneNumberId || !accessToken) {
    const message =
      "Meta WhatsApp credentials are not configured for production sending.";
    console.error("[WHATSAPP] FATAL:", message);
    throw new Error(message);
  }

  const payload = draft.meta_payload;

  console.log(`[WHATSAPP] Sending payload to Meta for ${payload.to}...`);

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.META_WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.META_WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = (await res.json()) as {
      error?: { message?: string };
      messages?: Array<{ id?: string }>;
    };

    if (!res.ok) {
      console.error("[META FATAL ERROR]:", JSON.stringify(data, null, 2));
      throw new Error(`Meta API rejected the message: ${data.error?.message}`);
    }

    console.log(
      "[WHATSAPP SUCCESS]: Message delivered. Meta ID:",
      data.messages?.[0]?.id
    );

    return {
      success: true,
      simulated: false,
      message: "WhatsApp reminder sent successfully.",
      draft,
    };
  } catch (error) {
    console.error("[WHATSAPP NETWORK ERROR]:", error);
    throw error;
  }
}

export async function sendWhatsAppTextMessage(
  to: string,
  messageBody: string
): Promise<boolean> {
  const cleanPhone = sanitizeMetaWhatsAppRecipient(to);
  const forceReal = process.env.TEST_REAL_WHATSAPP_LOCALLY === "true";
  const isDev = process.env.APP_ENV === "development";

  if (isDev && !forceReal) {
    console.log("[WHATSAPP TEXT] Mock reply to", cleanPhone, messageBody);
    return true;
  }

  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();

  if (!phoneNumberId || !accessToken) {
    console.error("[WHATSAPP] Missing Meta credentials for text dispatch");
    return false;
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    type: "text",
    text: {
      preview_url: true,
      body: messageBody,
    },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      console.error("[WHATSAPP TEXT ERROR]", JSON.stringify(err, null, 2));
      return false;
    }

    return true;
  } catch (error) {
    console.error("[WHATSAPP TEXT NETWORK ERROR]:", error);
    return false;
  }
}
