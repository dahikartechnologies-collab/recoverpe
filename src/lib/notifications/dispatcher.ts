import { SupabaseClient } from "@supabase/supabase-js";
import { getPayPageUrl } from "@/lib/app-url";
import { sendBusinessEmail } from "@/lib/email/nodemailer";
import {
  buildLegalNoticeEmail,
  buildPaymentReminderEmail,
} from "@/lib/email/templates";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { resolveDocumentLinkForWhatsApp } from "@/lib/document-whatsapp";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  isSmtpConfigured,
  isValidContactEmail,
  parseNotificationPreferences,
  parseSmtpSettings,
} from "@/lib/notification-settings";
import { isWhatsAppSendAllowed } from "@/lib/rate-limit";
import { getTraiCurfewMessage, isTraiCurfewActive } from "@/lib/trai-curfew";
import {
  draftLegalNoticeWhatsAppMessage,
  draftSmartCollectPaymentReceiptMessage,
  draftWhatsAppReminderMessage,
  sendWhatsAppMessage,
  TraiCurfewError,
} from "@/lib/whatsapp";
import { CommunicationType, SubscriptionPlan } from "@/types";

export interface OmnichannelMessagePayload {
  subscriptionPlan?: SubscriptionPlan;
  invoiceDocumentLink?: string | null;
  legalNoticeDocumentLink?: string | null;
  autopilotStep?: number;
  autopilotTone?: "polite" | "firm" | "critical";
  totalOutstandingBalance?: number;
  paymentReceipt?: {
    amountReceived: number;
    netOutstanding: number;
  };
}

export interface DispatchOmnichannelMessageParams {
  supabase: SupabaseClient;
  userId: string;
  businessId: string | null;
  contactId: string;
  ledgerId: string;
  messagePayload?: OmnichannelMessagePayload;
  options?: {
    isLegalNotice?: boolean;
    isPaymentReceipt?: boolean;
  };
}

export interface DispatchOmnichannelMessageResult {
  success: boolean;
  channel?: "whatsapp" | "email";
  simulated?: boolean;
  fallbackTriggered?: boolean;
  message: string;
  communicationType?: CommunicationType;
  error?: string;
}

async function logCommunication(
  supabase: SupabaseClient,
  ledgerId: string,
  type: CommunicationType
) {
  const { error } = await supabase.from("communication_logs").insert({
    ledger_id: ledgerId,
    type,
    status: "sent",
    cost_deducted: 0,
    executed_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message || "Failed to log communication.");
  }
}

async function tryWhatsAppDispatch(input: {
  supabase: SupabaseClient;
  userId: string;
  ledgerId: string;
  contactId: string;
  isLegalNotice: boolean;
  isPaymentReceipt: boolean;
  paymentReceipt?: {
    amountReceived: number;
    netOutstanding: number;
  };
  subscriptionPlan: SubscriptionPlan;
  businessName: string | null;
  businessId: string | null;
  invoiceDocumentLink: string | null;
  legalNoticeDocumentLink: string | null;
  autopilotTone?: "polite" | "firm" | "critical";
  totalOutstandingBalance?: number;
}): Promise<DispatchOmnichannelMessageResult | null> {
  if (isTraiCurfewActive()) {
    return null;
  }

  const allowed = await isWhatsAppSendAllowed(input.userId);

  if (!allowed) {
    return null;
  }

  const ledger = await fetchLedgerById(
    input.supabase,
    input.userId,
    input.ledgerId
  );

  if (!ledger) {
    throw new Error("Ledger not found.");
  }

  const draft = input.isPaymentReceipt
    ? draftSmartCollectPaymentReceiptMessage({
        contactName: ledger.contact.name,
        phoneNumber: ledger.contact.phone_number,
        amountReceived: input.paymentReceipt?.amountReceived ?? 0,
        netOutstanding: input.paymentReceipt?.netOutstanding ?? ledger.balance_due,
        ledgerId: input.ledgerId,
        businessId: input.businessId,
      })
    : input.isLegalNotice
    ? draftLegalNoticeWhatsAppMessage({
        ledger,
        businessName: input.businessName,
        legalNoticePdfUrl: input.legalNoticeDocumentLink ?? "",
      })
    : draftWhatsAppReminderMessage({
        ledger,
        business: input.businessName
          ? { business_name: input.businessName }
          : null,
        subscriptionPlan: input.subscriptionPlan,
        invoiceDocumentLink: input.invoiceDocumentLink,
        autopilotTone: input.autopilotTone,
        totalOutstandingBalance: input.totalOutstandingBalance,
      });

  const sendResult = await sendWhatsAppMessage(draft);

  await logCommunication(
    input.supabase,
    input.ledgerId,
    "whatsapp_reminder"
  );

  return {
    success: true,
    channel: "whatsapp",
    simulated: sendResult.simulated,
    fallbackTriggered: false,
    message: sendResult.message,
    communicationType: "whatsapp_reminder",
  };
}

async function tryEmailDispatch(input: {
  supabase: SupabaseClient;
  userId: string;
  businessId: string;
  contactId: string;
  ledgerId: string;
  isLegalNotice: boolean;
  businessName: string;
  smtpSettings: ReturnType<typeof parseSmtpSettings>;
  contactEmail: string;
  invoiceDocumentLink: string | null;
  legalNoticeDocumentLink: string | null;
  fallbackTriggered: boolean;
}): Promise<DispatchOmnichannelMessageResult> {
  const ledger = await fetchLedgerById(
    input.supabase,
    input.userId,
    input.ledgerId
  );

  if (!ledger) {
    throw new Error("Ledger not found.");
  }

  const emailContent = input.isLegalNotice
    ? buildLegalNoticeEmail({
        businessName: input.businessName,
        contactName: ledger.contact.name,
        amountDue: ledger.balance_due,
        invoiceNumber: ledger.invoice_number,
        ledgerId: ledger.id,
        legalNoticeUrl: input.legalNoticeDocumentLink ?? getPayPageUrl(ledger.id),
      })
    : buildPaymentReminderEmail({
        businessName: input.businessName,
        contactName: ledger.contact.name,
        invoiceNumber: ledger.invoice_number,
        amountDue: ledger.balance_due,
        dueDate: ledger.due_date,
        ledgerId: ledger.id,
        invoiceViewUrl: input.invoiceDocumentLink,
      });

  const sendResult = await sendBusinessEmail({
    smtpSettings: input.smtpSettings,
    to: input.contactEmail,
    subject: emailContent.subject,
    html: emailContent.html,
  });

  const communicationType: CommunicationType = input.isLegalNotice
    ? "email_invoice"
    : "email_reminder";

  await logCommunication(input.supabase, input.ledgerId, communicationType);

  return {
    success: true,
    channel: "email",
    simulated: sendResult.simulated,
    fallbackTriggered: input.fallbackTriggered,
    message: sendResult.message,
    communicationType,
  };
}

export async function dispatchOmnichannelMessage(
  params: DispatchOmnichannelMessageParams
): Promise<DispatchOmnichannelMessageResult> {
  const {
    supabase,
    userId,
    businessId,
    contactId,
    ledgerId,
    messagePayload = {},
    options = {},
  } = params;
  const isLegalNotice = Boolean(options.isLegalNotice);
  const isPaymentReceipt = Boolean(options.isPaymentReceipt);

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, name, phone_number, email")
    .eq("id", contactId)
    .eq("user_id", userId)
    .maybeSingle();

  if (contactError || !contact) {
    return {
      success: false,
      message: "Contact not found.",
      error: contactError?.message || "Contact not found.",
    };
  }

  let notificationPreferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  let smtpSettings = parseSmtpSettings(null);
  let businessName: string | null = null;

  if (businessId) {
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("business_name, notification_preferences, smtp_settings")
      .eq("id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    if (businessError) {
      return {
        success: false,
        message: "Failed to load business notification settings.",
        error: businessError.message,
      };
    }

    if (business) {
      businessName = business.business_name as string;
      notificationPreferences = parseNotificationPreferences(
        business.notification_preferences
      );
      smtpSettings = parseSmtpSettings(business.smtp_settings);
    }
  }

  const subscriptionPlan = messagePayload.subscriptionPlan ?? "free";
  let invoiceDocumentLink = messagePayload.invoiceDocumentLink ?? null;
  let legalNoticeDocumentLink = messagePayload.legalNoticeDocumentLink ?? null;

  if (!invoiceDocumentLink && !isLegalNotice) {
    const ledger = await fetchLedgerById(supabase, userId, ledgerId);

    if (ledger?.pdf_url) {
      invoiceDocumentLink = await resolveDocumentLinkForWhatsApp(
        ledger.pdf_url,
        "invoice",
        ledgerId
      );
    }
  }

  if (!legalNoticeDocumentLink && isLegalNotice) {
    const ledger = await fetchLedgerById(supabase, userId, ledgerId);

    if (ledger?.legal_notice_pdf_url) {
      legalNoticeDocumentLink = await resolveDocumentLinkForWhatsApp(
        ledger.legal_notice_pdf_url,
        "legal-notice",
        ledgerId
      );
    }
  }

  let whatsappFailed = false;

  if (notificationPreferences.whatsapp_enabled) {
    try {
      const whatsappResult = await tryWhatsAppDispatch({
        supabase,
        userId,
        ledgerId,
        contactId,
        isLegalNotice,
        isPaymentReceipt,
        paymentReceipt: messagePayload.paymentReceipt,
        subscriptionPlan,
        businessName,
        businessId,
        invoiceDocumentLink,
        legalNoticeDocumentLink,
        autopilotTone: messagePayload.autopilotTone,
        totalOutstandingBalance: messagePayload.totalOutstandingBalance,
      });

      if (whatsappResult) {
        return whatsappResult;
      }

      whatsappFailed = true;
    } catch (error) {
      whatsappFailed = true;

      if (error instanceof TraiCurfewError) {
        // Fall through to email when configured.
      } else if (!notificationPreferences.auto_fallback) {
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : "WhatsApp dispatch failed.",
          error:
            error instanceof Error
              ? error.message
              : "WhatsApp dispatch failed.",
        };
      }
    }
  }

  const contactEmail = (contact.email as string | null) ?? null;
  const smtpReady = isSmtpConfigured(smtpSettings);
  const emailReady = isValidContactEmail(contactEmail);
  const shouldSendEmail =
    businessId &&
    smtpReady &&
    emailReady &&
    (notificationPreferences.email_enabled ||
      (notificationPreferences.auto_fallback && whatsappFailed));

  if (shouldSendEmail) {
    try {
      return await tryEmailDispatch({
        supabase,
        userId,
        businessId,
        contactId,
        ledgerId,
        isLegalNotice,
        businessName: businessName ?? "Recoverpe Business",
        smtpSettings,
        contactEmail: contactEmail!.trim(),
        invoiceDocumentLink,
        legalNoticeDocumentLink,
        fallbackTriggered: whatsappFailed,
      });
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Email dispatch failed.",
        error:
          error instanceof Error ? error.message : "Email dispatch failed.",
      };
    }
  }

  if (isTraiCurfewActive() && notificationPreferences.whatsapp_enabled) {
    return {
      success: false,
      message: getTraiCurfewMessage(),
      error: getTraiCurfewMessage(),
    };
  }

  return {
    success: false,
    message:
      "No delivery channel available. Enable WhatsApp, configure SMTP, or add a contact email.",
    error: "No delivery channel available.",
  };
}
