import {
  BusinessNotificationPreferences,
  BusinessSmtpSettings,
  SubscriptionPlan,
} from "@/types";
import {
  isValidContactEmail,
  parseNotificationPreferences,
  parseSmtpSettings,
} from "@/lib/notification-settings";
import {
  validatePremiumAutopilotSchedule,
} from "@/lib/autopilot-schedule";

export interface UpdateBusinessSettingsPayload {
  msme_reg_no?: string | null;
  khata_auto_approve?: boolean;
  business_name?: string;
  business_address?: string | null;
  gstin?: string | null;
  notification_preferences?: BusinessNotificationPreferences;
  smtp_settings?: BusinessSmtpSettings;
  autopilot_schedule?: number[];
}

export interface ValidatedBusinessSettingsUpdate {
  msme_reg_no?: string | null;
  khata_auto_approve?: boolean;
  business_name?: string;
  business_address?: string | null;
  gstin?: string | null;
  notification_preferences?: BusinessNotificationPreferences;
  smtp_settings?: BusinessSmtpSettings;
  autopilot_schedule?: number[];
}

const MSME_REG_NO_MAX_LENGTH = 32;
const BUSINESS_NAME_MAX_LENGTH = 120;
const BUSINESS_ADDRESS_MAX_LENGTH = 500;
const GSTIN_LENGTH = 15;

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidMsmeRegNo(value: string): boolean {
  return /^[A-Z0-9][A-Z0-9\-/]{4,31}$/i.test(value);
}

function isValidGstin(value: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value);
}

export function validateBusinessSettingsUpdate(
  body: UpdateBusinessSettingsPayload,
  options?: { subscriptionPlan?: SubscriptionPlan }
): { data?: ValidatedBusinessSettingsUpdate; error?: string } {
  if (
    body.msme_reg_no === undefined &&
    body.khata_auto_approve === undefined &&
    body.business_name === undefined &&
    body.business_address === undefined &&
    body.gstin === undefined &&
    body.notification_preferences === undefined &&
    body.smtp_settings === undefined &&
    body.autopilot_schedule === undefined
  ) {
    return { error: "No business settings fields provided to update." };
  }

  const data: ValidatedBusinessSettingsUpdate = {};

  if (body.business_name !== undefined) {
    const businessName = body.business_name.trim();

    if (!businessName) {
      return { error: "Business name cannot be empty." };
    }

    if (businessName.length > BUSINESS_NAME_MAX_LENGTH) {
      return {
        error: `Business name must be ${BUSINESS_NAME_MAX_LENGTH} characters or fewer.`,
      };
    }

    data.business_name = businessName;
  }

  if (body.business_address !== undefined) {
    const businessAddress = normalizeOptionalString(body.business_address);

    if (businessAddress && businessAddress.length > BUSINESS_ADDRESS_MAX_LENGTH) {
      return {
        error: `Business address must be ${BUSINESS_ADDRESS_MAX_LENGTH} characters or fewer.`,
      };
    }

    data.business_address = businessAddress;
  }

  if (body.gstin !== undefined) {
    const gstin = normalizeOptionalString(body.gstin);

    if (gstin) {
      const normalizedGstin = gstin.toUpperCase();

      if (normalizedGstin.length !== GSTIN_LENGTH || !isValidGstin(normalizedGstin)) {
        return { error: "Enter a valid 15-character GSTIN." };
      }

      data.gstin = normalizedGstin;
    } else {
      data.gstin = null;
    }
  }

  if (body.msme_reg_no !== undefined) {
    const msmeRegNo = normalizeOptionalString(body.msme_reg_no);

    if (msmeRegNo && msmeRegNo.length > MSME_REG_NO_MAX_LENGTH) {
      return {
        error: `MSME registration number must be ${MSME_REG_NO_MAX_LENGTH} characters or fewer.`,
      };
    }

    if (msmeRegNo && !isValidMsmeRegNo(msmeRegNo)) {
      return {
        error:
          "Enter a valid MSME / Udyam registration number (e.g. UDYAM-MH-00-0000000).",
      };
    }

    data.msme_reg_no = msmeRegNo ? msmeRegNo.toUpperCase() : null;
  }

  if (body.khata_auto_approve !== undefined) {
    if (typeof body.khata_auto_approve !== "boolean") {
      return { error: "khata_auto_approve must be a boolean." };
    }

    data.khata_auto_approve = body.khata_auto_approve;
  }

  if (body.notification_preferences !== undefined) {
    const preferences = parseNotificationPreferences(body.notification_preferences);
    data.notification_preferences = preferences;
  }

  if (body.smtp_settings !== undefined) {
    const smtpSettings = parseSmtpSettings(body.smtp_settings);

    if (smtpSettings.from_email && !isValidContactEmail(smtpSettings.from_email)) {
      return { error: "Enter a valid sender email address." };
    }

    data.smtp_settings = smtpSettings;
  }

  if (body.autopilot_schedule !== undefined) {
    const subscriptionPlan = options?.subscriptionPlan ?? "free";

    if (subscriptionPlan !== "premium") {
      return {
        error:
          "Upgrade to Premium to customize your Recovery Autopilot schedule.",
      };
    }

    const validation = validatePremiumAutopilotSchedule(body.autopilot_schedule);

    if (!validation.valid) {
      return { error: validation.error };
    }

    data.autopilot_schedule = validation.schedule;
  }

  return { data };
}
