import { Business } from "@/types";

export function buildInvoiceNumber(business: Business): string {
  const prefix = business.invoice_prefix ?? "";
  const suffix = business.financial_year_suffix ?? "";
  const sequence = String(business.next_invoice_sequence).padStart(4, "0");

  return `${prefix}${sequence}${suffix}`;
}

export function formatIndianPhoneNumber(digits: string): string {
  const normalized = digits.replace(/\D/g, "");

  if (normalized.length === 10) {
    return `+91${normalized}`;
  }

  if (normalized.startsWith("91") && normalized.length === 12) {
    return `+${normalized}`;
  }

  if (normalized.startsWith("+")) {
    return normalized;
  }

  return `+91${normalized.slice(-10)}`;
}
