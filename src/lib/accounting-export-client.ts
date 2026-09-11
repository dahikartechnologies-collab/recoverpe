import { getAuthHeaders } from "@/lib/auth-headers";
import type { Gstr3bSummary } from "@/lib/accounting-export";

export type AccountingExportFormat = "tally_xml" | "csv" | "json";

export interface AccountingSummaryResponse {
  businessName: string;
  businessGstin: string | null;
  fromDate: string;
  toDate: string;
  sales: unknown[];
  receipts: unknown[];
  purchases: unknown[];
  gstr3b: Gstr3bSummary;
}

function buildExportUrl(
  format: AccountingExportFormat,
  fromDate: string,
  toDate: string
): string {
  const params = new URLSearchParams({
    format,
    from: fromDate,
    to: toDate,
  });

  return `/api/export/accounting?${params.toString()}`;
}

export async function fetchAccountingSummary(
  fromDate: string,
  toDate: string
): Promise<AccountingSummaryResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(buildExportUrl("json", fromDate, toDate), {
    headers,
  });
  const payload = (await response.json()) as AccountingSummaryResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Failed to load accounting summary.");
  }

  return payload;
}

/**
 * Downloads an export file. The route is bearer-authenticated so the browser
 * cannot navigate to it directly; the body is fetched and saved as a blob.
 */
export async function downloadAccountingExport(
  format: Exclude<AccountingExportFormat, "json">,
  fromDate: string,
  toDate: string
): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(buildExportUrl(format, fromDate, toDate), {
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error || "Failed to download export.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = `recoverpe-books-${fromDate}-to-${toDate}.${
    format === "tally_xml" ? "xml" : "csv"
  }`;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
