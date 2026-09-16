import { differenceInCalendarDays } from "date-fns";
import { SupabaseClient } from "@supabase/supabase-js";
import { getPayPageUrl } from "@/lib/app-url";
import {
  BusinessEntitlementRow,
  hasEntitlement,
  resolveEffectiveTier,
} from "@/lib/entitlements";
import { sendDebtReminderEmail } from "@/lib/notifications/email";
import {
  buildDebtReminderSmsMessage,
  sendTransactionalSms,
} from "@/lib/notifications/sms";
import {
  dispatchOmnichannelMessage,
  DispatchOmnichannelMessageResult,
} from "@/lib/notifications/dispatcher";
import {
  isSmtpConfigured,
  isValidContactEmail,
  parseSmtpSettings,
} from "@/lib/notification-settings";
import { recordCommunicationSafely } from "@/lib/communication-logs";
import { parseDateOnly } from "@/lib/timezone";
import { BusinessSubscriptionTier } from "@/types";

export type DebtReminderType = "normal" | "overdue_escalation";

interface BusinessReminderRow {
  business_name: string;
  subscription_tier: BusinessSubscriptionTier;
  subscription_status?: string | null;
  addons?: unknown;
  notification_preferences?: unknown;
  smtp_settings?: unknown;
}

export interface DispatchDebtReminderResult {
  whatsapp?: DispatchOmnichannelMessageResult;
  sms?: { success: boolean; message: string };
  email?: { success: boolean; message: string };
}

async function logChannelAttempt(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessId: string | null;
    contactId: string;
    ledgerId: string;
    channel: "sms" | "email";
    type: "sms_reminder" | "email_reminder";
    status: "sent" | "failed";
    summary: string;
    externalMessageId?: string | null;
  }
) {
  await recordCommunicationSafely(supabase, {
    userId: input.userId,
    businessId: input.businessId,
    contactId: input.contactId,
    ledgerId: input.ledgerId,
    type: input.type,
    channel: input.channel,
    direction: "outbound",
    status: input.status,
    externalMessageId: input.externalMessageId ?? null,
    summary: input.summary,
  });
}

export async function dispatchDebtReminder(
  supabase: SupabaseClient,
  ledgerId: string,
  reminderType: DebtReminderType = "normal"
): Promise<DispatchDebtReminderResult> {
  const { data: ledgerRow, error: ledgerError } = await supabase
    .from("ledgers")
    .select("id, user_id, contact_id, business_id, balance_due, due_date, invoice_number")
    .eq("id", ledgerId)
    .maybeSingle();

  if (ledgerError || !ledgerRow) {
    throw new Error("Ledger not found for debt reminder.");
  }

  const userId = ledgerRow.user_id as string;
  const contactId = ledgerRow.contact_id as string;
  const businessId = (ledgerRow.business_id as string | null) ?? null;

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, name, phone_number, email, sms_opt_out, email_opt_out")
    .eq("id", contactId)
    .eq("user_id", userId)
    .maybeSingle();

  if (contactError || !contact) {
    throw new Error("Contact not found for debt reminder.");
  }

  let businessRow: BusinessReminderRow | null = null;

  if (businessId) {
    const { data, error } = await supabase
      .from("businesses")
      .select(
        "business_name, subscription_tier, subscription_status, addons, notification_preferences, smtp_settings"
      )
      .eq("id", businessId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to load business for reminder.");
    }

    if (data) {
      businessRow = {
        business_name: data.business_name as string,
        subscription_tier:
          (data.subscription_tier as BusinessSubscriptionTier | null) ?? "free",
        subscription_status: data.subscription_status as string | null | undefined,
        addons: data.addons,
        notification_preferences: data.notification_preferences,
        smtp_settings: data.smtp_settings,
      };
    }
  }

  const businessEntitlements: BusinessEntitlementRow | null = businessRow
    ? {
        subscription_tier: businessRow.subscription_tier,
        subscription_status: businessRow.subscription_status,
        addons: businessRow.addons,
      }
    : null;

  const effectiveTier = resolveEffectiveTier(businessEntitlements);
  const daysOverdue = differenceInCalendarDays(
    new Date(),
    parseDateOnly(ledgerRow.due_date as string)
  );

  const whatsapp = await dispatchOmnichannelMessage({
    supabase,
    userId,
    businessId,
    contactId,
    ledgerId,
    messagePayload: {
      subscriptionPlan:
        effectiveTier === "premium" || effectiveTier === "business"
          ? "premium"
          : "free",
    },
  });

  const result: DispatchDebtReminderResult = { whatsapp };

  const shouldSendSms =
    hasEntitlement(businessEntitlements, "omnichannel_escalation") &&
    daysOverdue > 3 &&
    !contact.sms_opt_out;

  if (shouldSendSms) {
    try {
      const payUrl = getPayPageUrl(ledgerId);
      const smsResult = await sendTransactionalSms({
        phoneNumber: contact.phone_number as string,
        message: buildDebtReminderSmsMessage({
          amount: Number(ledgerRow.balance_due),
          businessName: businessRow?.business_name ?? "RecoverPe Merchant",
          payUrl,
        }),
      });

      if (smsResult.success) {
        await logChannelAttempt(supabase, {
          userId,
          businessId,
          contactId,
          ledgerId,
          channel: "sms",
          type: "sms_reminder",
          status: "sent",
          summary: reminderType === "overdue_escalation"
            ? "Overdue SMS escalation sent"
            : "Payment reminder SMS sent",
          externalMessageId: smsResult.externalMessageId,
        });

        result.sms = { success: true, message: smsResult.message };
      } else {
        const failureSummary =
          smsResult.error ?? smsResult.message ?? "SMS dispatch failed.";

        await logChannelAttempt(supabase, {
          userId,
          businessId,
          contactId,
          ledgerId,
          channel: "sms",
          type: "sms_reminder",
          status: "failed",
          summary:
            smsResult.status === "DLT_PENDING"
              ? `DLT pending: ${failureSummary}`
              : failureSummary,
        });

        result.sms = { success: false, message: failureSummary };
      }
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "SMS dispatch failed.";

      await logChannelAttempt(supabase, {
        userId,
        businessId,
        contactId,
        ledgerId,
        channel: "sms",
        type: "sms_reminder",
        status: "failed",
        summary: reason,
      });

      result.sms = { success: false, message: reason };
    }
  } else if (hasEntitlement(businessEntitlements, "sms_receipts")) {
    // Business tier SMS is reserved for settlement receipts; reminders stay WhatsApp-only.
  }

  const shouldSendEmail =
    hasEntitlement(businessEntitlements, "omnichannel_escalation") &&
    daysOverdue > 7 &&
    !contact.email_opt_out &&
    isValidContactEmail((contact.email as string | null) ?? null);

  if (shouldSendEmail) {
    const smtpSettings = parseSmtpSettings(businessRow?.smtp_settings);
    const canEmail =
      Boolean(process.env.RESEND_API_KEY?.trim()) || isSmtpConfigured(smtpSettings);

    if (canEmail) {
      try {
        const emailResult = await sendDebtReminderEmail({
          to: (contact.email as string).trim(),
          businessName: businessRow?.business_name ?? "RecoverPe Merchant",
          contactName: contact.name as string,
          invoiceNumber: (ledgerRow.invoice_number as string | null) ?? null,
          amountDue: Number(ledgerRow.balance_due),
          dueDate: ledgerRow.due_date as string,
          ledgerId,
          smtpSettings,
        });

        if (emailResult.success) {
          await logChannelAttempt(supabase, {
            userId,
            businessId,
            contactId,
            ledgerId,
            channel: "email",
            type: "email_reminder",
            status: "sent",
            summary: "Overdue email escalation sent",
          });

          result.email = { success: true, message: emailResult.message };
        } else {
          const failureSummary =
            emailResult.error ?? emailResult.message ?? "Email dispatch failed.";

          await logChannelAttempt(supabase, {
            userId,
            businessId,
            contactId,
            ledgerId,
            channel: "email",
            type: "email_reminder",
            status: "failed",
            summary: failureSummary,
          });

          result.email = { success: false, message: failureSummary };
        }
      } catch (error) {
        const reason =
          error instanceof Error ? error.message : "Email dispatch failed.";

        await logChannelAttempt(supabase, {
          userId,
          businessId,
          contactId,
          ledgerId,
          channel: "email",
          type: "email_reminder",
          status: "failed",
          summary: reason,
        });

        result.email = { success: false, message: reason };
      }
    }
  }

  return result;
}

export async function dispatchPaymentSettlementSms(
  supabase: SupabaseClient,
  input: {
    userId: string;
    businessId: string | null;
    contactId: string;
    ledgerId: string;
    amountReceived: number;
    businessName: string;
  }
): Promise<void> {
  if (!input.businessId) {
    return;
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("subscription_tier, subscription_status, addons")
    .eq("id", input.businessId)
    .maybeSingle();

  const businessEntitlements: BusinessEntitlementRow = {
    subscription_tier:
      (business?.subscription_tier as BusinessSubscriptionTier | undefined) ??
      "free",
    subscription_status: business?.subscription_status as string | null | undefined,
    addons: business?.addons,
  };

  if (!hasEntitlement(businessEntitlements, "sms_receipts")) {
    return;
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("phone_number, sms_opt_out")
    .eq("id", input.contactId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (!contact || contact.sms_opt_out) {
    return;
  }

  const amountLabel = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(input.amountReceived);

  try {
    const smsResult = await sendTransactionalSms({
      phoneNumber: contact.phone_number as string,
      message: `Payment of ${amountLabel} received for ${input.businessName}. Thank you! - RecoverPe`,
    });

    if (smsResult.success) {
      await logChannelAttempt(supabase, {
        userId: input.userId,
        businessId: input.businessId,
        contactId: input.contactId,
        ledgerId: input.ledgerId,
        channel: "sms",
        type: "sms_reminder",
        status: "sent",
        summary: "Payment settlement SMS receipt sent",
        externalMessageId: smsResult.externalMessageId,
      });
      return;
    }

    await logChannelAttempt(supabase, {
      userId: input.userId,
      businessId: input.businessId,
      contactId: input.contactId,
      ledgerId: input.ledgerId,
      channel: "sms",
      type: "sms_reminder",
      status: "failed",
      summary:
        smsResult.status === "DLT_PENDING"
          ? `DLT pending: ${smsResult.error ?? smsResult.message}`
          : smsResult.error ?? smsResult.message,
    });
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Settlement SMS failed.";

    await logChannelAttempt(supabase, {
      userId: input.userId,
      businessId: input.businessId,
      contactId: input.contactId,
      ledgerId: input.ledgerId,
      channel: "sms",
      type: "sms_reminder",
      status: "failed",
      summary: reason,
    });
  }
}
