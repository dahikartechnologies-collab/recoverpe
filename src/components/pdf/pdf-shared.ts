import { Font } from "@react-pdf/renderer";

let pdfDefaultsRegistered = false;

/** Disable auto-hyphenation so legal terms are not broken across lines. */
export function registerPdfDefaults(): void {
  if (pdfDefaultsRegistered) {
    return;
  }

  Font.registerHyphenationCallback((word) => [word]);
  pdfDefaultsRegistered = true;
}

/** ASCII-safe Indian Rupee formatting — avoids corrupted ₹ glyphs in Helvetica. */
export function formatPdfRupee(amount: number): string {
  const normalized = Number.isFinite(amount) ? amount : 0;

  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(normalized);

  return `Rs. ${formatted}`;
}

export function safePdfText(
  value: string | null | undefined,
  fallback: string
): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export const PDF_COLORS = {
  black: "#0A0A0A",
  gray700: "#374151",
  gray500: "#6B7280",
  gray200: "#E5E7EB",
  gray100: "#F3F4F6",
  gray50: "#F9FAFB",
  white: "#FFFFFF",
} as const;

export function formatPdfChannel(type: string): string {
  switch (type) {
    case "whatsapp_reminder":
      return "WhatsApp";
    case "vapi_call":
      return "AI Call";
    case "email_invoice":
    case "email_reminder":
      return "Email";
    default:
      return type.replace(/_/g, " ");
  }
}

export function formatPdfTimestampIst(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return safePdfText(value, "Not recorded");
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(parsed);
}

export function formatPdfDeliveryStatus(status: string): string {
  return status.replace(/_/g, " ");
}
