export type LedgerDocumentType = "invoice" | "legal-notice" | "samadhaan-docket";

const STORAGE_PATH_PATTERN = /^(secure|businesses|users)\/[a-z0-9_./-]+$/i;

export function ledgerInvoiceStoragePath(ledgerId: string): string {
  return `secure/invoices/${ledgerId}.pdf`;
}

export function ledgerLegalNoticeStoragePath(ledgerId: string): string {
  return `secure/legal_notices/${ledgerId}.pdf`;
}

export function ledgerSamadhaanDocketStoragePath(ledgerId: string): string {
  return `secure/samadhaan_dockets/${ledgerId}.pdf`;
}

export function ledgerEvidenceStoragePath(
  ledgerId: string,
  fileName: string
): string {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  return `secure/evidence/${ledgerId}/${safeFileName}`;
}

export function businessLedgerEvidenceStoragePath(
  businessId: string,
  ledgerId: string,
  fileName: string
): string {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  return `businesses/${businessId}/ledgers/${ledgerId}/${safeFileName}`;
}

export function canonicalLedgerDocumentPath(
  type: LedgerDocumentType,
  ledgerId: string
): string {
  switch (type) {
    case "invoice":
      return ledgerInvoiceStoragePath(ledgerId);
    case "legal-notice":
      return ledgerLegalNoticeStoragePath(ledgerId);
    case "samadhaan-docket":
      return ledgerSamadhaanDocketStoragePath(ledgerId);
  }
}

export function isStoragePath(value: string): boolean {
  return STORAGE_PATH_PATTERN.test(value.trim());
}

/** Normalizes legacy signed URLs to a GCS object path when possible. */
export function normalizeStoragePath(
  value: string | null | undefined,
  fallbackPath?: string
): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallbackPath ?? null;
  }

  if (isStoragePath(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const firebaseObjectMatch = url.pathname.match(/\/o\/(.+)$/);

      if (firebaseObjectMatch?.[1]) {
        return decodeURIComponent(firebaseObjectMatch[1]);
      }

      const gcsMatch = url.pathname.match(/\/([^/]+\.appspot\.com)\/(.+)$/);

      if (gcsMatch?.[2]) {
        return gcsMatch[2];
      }

      const securePathMatch = trimmed.match(/(secure\/[^?]+)/);

      if (securePathMatch?.[1]) {
        return securePathMatch[1];
      }
    } catch {
      return fallbackPath ?? null;
    }
  }

  return fallbackPath ?? null;
}

export function resolveLedgerDocumentPath(
  storedValue: string | null | undefined,
  type: LedgerDocumentType,
  ledgerId: string
): string | null {
  return normalizeStoragePath(
    storedValue,
    canonicalLedgerDocumentPath(type, ledgerId)
  );
}

export function parseLedgerDocumentType(
  value: string | null | undefined
): LedgerDocumentType | null {
  switch (value?.trim()) {
    case "invoice":
      return "invoice";
    case "legal-notice":
      return "legal-notice";
    case "samadhaan-docket":
      return "samadhaan-docket";
    default:
      return null;
  }
}
