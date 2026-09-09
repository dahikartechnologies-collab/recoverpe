import { getAuthHeaders } from "@/lib/auth-headers";
import { EvidenceAttachment, EvidenceFileType, EvidenceVaultResponse } from "@/types";

export async function fetchEvidenceVault(
  ledgerId: string
): Promise<EvidenceVaultResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/ledgers/${ledgerId}/evidence`, { headers });
  const body = (await response.json()) as EvidenceVaultResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to load evidence vault.");
  }

  return body;
}

export async function uploadEvidenceFile(
  ledgerId: string,
  file: File,
  fileType?: EvidenceFileType
): Promise<EvidenceAttachment> {
  const headers = await getAuthHeaders();
  const formData = new FormData();
  formData.append("file", file);

  if (fileType) {
    formData.append("file_type", fileType);
  }

  const response = await fetch(`/api/ledgers/${ledgerId}/evidence`, {
    method: "POST",
    headers,
    body: formData,
  });
  const body = (await response.json()) as { attachment?: EvidenceAttachment; error?: string };

  if (!response.ok || !body.attachment) {
    throw new Error(body.error || "Failed to upload evidence file.");
  }

  return body.attachment;
}

export function buildEvidenceDownloadRoute(
  ledgerId: string,
  attachmentId: string
): string {
  return `/api/ledgers/${ledgerId}/evidence/${attachmentId}`;
}

export async function openEvidenceFile(
  ledgerId: string,
  attachmentId: string
): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(buildEvidenceDownloadRoute(ledgerId, attachmentId), {
    headers,
    redirect: "manual",
  });

  if (response.status === 307 || response.status === 302) {
    const location = response.headers.get("Location");

    if (!location) {
      throw new Error("Evidence download redirect is missing.");
    }

    window.open(location, "_blank", "noopener,noreferrer");
    return;
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Failed to open evidence file.");
  }
}
