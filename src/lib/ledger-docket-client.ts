import { getAuthHeaders } from "@/lib/auth-headers";
import { downloadPdfFromApiRoute, openDocumentFromApiRoute } from "@/lib/pdf-download";
import { MicroTransactionFulfillment } from "@/types";

function evidenceDocketRoute(ledgerId: string): string {
  return `/api/ledgers/${ledgerId}/docket`;
}

export async function openEvidenceDocketPdf(ledgerId: string): Promise<void> {
  const headers = await getAuthHeaders();
  await openDocumentFromApiRoute(evidenceDocketRoute(ledgerId), headers);
}

export async function downloadEvidenceDocketPdf(ledgerId: string): Promise<void> {
  const headers = await getAuthHeaders();
  await downloadPdfFromApiRoute(
    evidenceDocketRoute(ledgerId),
    `evidence-docket-${ledgerId}.pdf`,
    headers
  );
}

export async function loadSamadhaanFulfillment(
  ledgerId: string
): Promise<MicroTransactionFulfillment> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/ledgers/${ledgerId}/samadhaan-docket`, {
    method: "POST",
    headers,
  });

  const body = (await response.json()) as {
    error?: string;
    pdf_url?: string;
    samadhaan_meta?: MicroTransactionFulfillment["samadhaan_meta"];
  };

  if (!response.ok || !body.pdf_url) {
    throw new Error(body.error || "Failed to load Samadhaan kit.");
  }

  return {
    purchase_type: "samadhaan_499",
    ledger_id: ledgerId,
    pdf_url: body.pdf_url,
    samadhaan_meta: body.samadhaan_meta,
  };
}
