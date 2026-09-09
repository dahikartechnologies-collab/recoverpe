import {
  BusinessNotificationPreferences,
  BusinessSmtpSettings,
} from "@/types";

export const DEFAULT_NOTIFICATION_PREFERENCES: BusinessNotificationPreferences =
  {
    whatsapp_enabled: true,
    email_enabled: false,
    auto_fallback: true,
  };

export const DEFAULT_SMTP_SETTINGS: BusinessSmtpSettings = {
  host: "",
  port: 587,
  secure: false,
  user: "",
  pass: "",
  from_name: "",
  from_email: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseNotificationPreferences(
  value: unknown
): BusinessNotificationPreferences {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }

  const record = value as Record<string, unknown>;

  return {
    whatsapp_enabled:
      typeof record.whatsapp_enabled === "boolean"
        ? record.whatsapp_enabled
        : DEFAULT_NOTIFICATION_PREFERENCES.whatsapp_enabled,
    email_enabled:
      typeof record.email_enabled === "boolean"
        ? record.email_enabled
        : DEFAULT_NOTIFICATION_PREFERENCES.email_enabled,
    auto_fallback:
      typeof record.auto_fallback === "boolean"
        ? record.auto_fallback
        : DEFAULT_NOTIFICATION_PREFERENCES.auto_fallback,
  };
}

export function parseSmtpSettings(value: unknown): BusinessSmtpSettings {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_SMTP_SETTINGS };
  }

  const record = value as Record<string, unknown>;
  const port = Number(record.port);

  return {
    host: typeof record.host === "string" ? record.host.trim() : "",
    port: Number.isFinite(port) && port > 0 ? port : DEFAULT_SMTP_SETTINGS.port,
    secure: Boolean(record.secure),
    user: typeof record.user === "string" ? record.user.trim() : "",
    pass: typeof record.pass === "string" ? record.pass : "",
    from_name:
      typeof record.from_name === "string" ? record.from_name.trim() : "",
    from_email:
      typeof record.from_email === "string" ? record.from_email.trim() : "",
  };
}

export function isSmtpConfigured(settings: BusinessSmtpSettings): boolean {
  return Boolean(
    settings.host &&
      settings.user &&
      settings.pass &&
      settings.from_email &&
      EMAIL_PATTERN.test(settings.from_email)
  );
}

export function isValidContactEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) {
    return false;
  }

  return EMAIL_PATTERN.test(email.trim());
}
