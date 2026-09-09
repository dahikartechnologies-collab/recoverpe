import { LedgerDocumentType } from "@/lib/document-storage";

export function buildDocumentDownloadRoute(
  type: LedgerDocumentType,
  ledgerId: string
): string {
  const params = new URLSearchParams({
    type,
    id: ledgerId,
  });

  return `/api/documents/download?${params.toString()}`;
}

export async function openDocumentFromApiRoute(
  route: string,
  headers: HeadersInit
): Promise<void> {
  const response = await fetch(route, {
    headers,
    redirect: "manual",
  });

  if (response.status === 307 || response.status === 302) {
    const location = response.headers.get("Location");

    if (!location) {
      throw new Error("Document download redirect is missing.");
    }

    window.open(location, "_blank", "noopener,noreferrer");
    return;
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error || "Failed to open document.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function downloadDocumentFromApiRoute(
  type: LedgerDocumentType,
  ledgerId: string,
  filename: string,
  headers: HeadersInit
): Promise<void> {
  const route = buildDocumentDownloadRoute(type, ledgerId);
  const response = await fetch(route, {
    headers,
    redirect: "manual",
  });

  if (response.status === 307 || response.status === 302) {
    const location = response.headers.get("Location");

    if (!location) {
      throw new Error("Document download redirect is missing.");
    }

    await downloadPdfFromUrl(location, filename);
    return;
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error || "Failed to download document.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadPdfFromUrl(
  pdfUrl: string,
  filename: string
): Promise<void> {
  const response = await fetch(pdfUrl);

  if (!response.ok) {
    throw new Error("Failed to fetch PDF for download.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadPdfFromApiRoute(
  route: string,
  filename: string,
  headers: HeadersInit
): Promise<void> {
  const response = await fetch(route, { headers });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error || "Failed to download PDF.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
