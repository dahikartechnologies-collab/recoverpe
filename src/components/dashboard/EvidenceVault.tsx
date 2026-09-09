"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, Upload } from "lucide-react";
import {
  fetchEvidenceVault,
  openEvidenceFile,
  uploadEvidenceFile,
} from "@/lib/evidence-client";
import { getAuthHeaders } from "@/lib/auth-headers";
import { EvidenceAttachment, EvidenceFileType } from "@/types";

const ACCEPTED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png";
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

interface EvidenceVaultProps {
  ledgerId: string;
  compact?: boolean;
}

function inferFileType(file: File): EvidenceFileType {
  const lowerName = file.name.toLowerCase();

  if (lowerName.includes("pod") || lowerName.includes("delivery")) {
    return "POD";
  }

  if (lowerName.includes("contract") || lowerName.includes("agreement")) {
    return "Contract";
  }

  if (file.type === "image/jpeg" || file.type === "image/png") {
    return "Photo";
  }

  if (file.type === "application/pdf") {
    return "Invoice";
  }

  return "Other";
}

function EvidenceIcon({ fileType }: { fileType: EvidenceFileType }) {
  if (fileType === "Photo") {
    return <ImageIcon className="h-4 w-4 shrink-0 text-recoverpe-black" />;
  }

  return <FileText className="h-4 w-4 shrink-0 text-recoverpe-black" />;
}

export function EvidenceVault({ ledgerId, compact = false }: EvidenceVaultProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<EvidenceAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [isDownloadingDocket, setIsDownloadingDocket] = useState(false);

  const loadAttachments = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetchEvidenceVault(ledgerId);
      setAttachments(response.attachments);
    } catch (loadError) {
      setAttachments([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load evidence vault."
      );
    } finally {
      setIsLoading(false);
    }
  }, [ledgerId]);

  useEffect(() => {
    void loadAttachments();
  }, [loadAttachments]);

  async function handleFiles(files: FileList | File[]) {
    const fileList = Array.from(files).filter((file) =>
      ACCEPTED_MIME_TYPES.has(file.type)
    );

    if (fileList.length === 0) {
      setError("Upload PDF, JPG, or PNG files only.");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      for (const file of fileList) {
        await uploadEvidenceFile(ledgerId, file, inferFileType(file));
      }

      await loadAttachments();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload evidence."
      );
    } finally {
      setIsUploading(false);
      setIsDragging(false);
    }
  }

  async function handleOpenAttachment(attachment: EvidenceAttachment) {
    setOpeningId(attachment.id);

    try {
      await openEvidenceFile(ledgerId, attachment.id);
    } catch (openError) {
      setError(
        openError instanceof Error ? openError.message : "Failed to open file."
      );
    } finally {
      setOpeningId(null);
    }
  }

  async function handleDownloadLegalDocket() {
    setIsDownloadingDocket(true);
    setError("");

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/ledgers/${ledgerId}/docket`, { headers });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Failed to download legal docket.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `legal-docket-${ledgerId}.pdf`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download legal docket."
      );
    } finally {
      setIsDownloadingDocket(false);
    }
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3
            className={`font-semibold text-recoverpe-black ${
              compact ? "text-sm" : "text-base"
            }`}
          >
            Evidence Vault
          </h3>
          <p className="mt-1 text-xs text-recoverpe-grey-medium">
            Attach PODs, contracts, and photos for legal notices and Samadhaan
            dockets.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleDownloadLegalDocket()}
          disabled={isDownloadingDocket}
          className="shrink-0 rounded-md border border-recoverpe-black px-3 py-1.5 text-xs font-medium text-recoverpe-black transition hover:bg-recoverpe-grey-light/40 disabled:opacity-60"
        >
          {isDownloadingDocket ? "Generating..." : "Download Legal Docket"}
        </button>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          void handleFiles(event.dataTransfer.files);
        }}
        className={`rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
          isDragging
            ? "border-recoverpe-black bg-recoverpe-grey-light/50"
            : "border-recoverpe-grey-light bg-recoverpe-white"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) {
              void handleFiles(event.target.files);
              event.target.value = "";
            }
          }}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-2 text-sm text-recoverpe-grey-medium">
            <Loader2 className="h-5 w-5 animate-spin text-recoverpe-black" />
            Uploading evidence...
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-5 w-5 text-recoverpe-black" />
            <p className="mt-3 text-sm text-recoverpe-black">
              Drag and drop files here, or{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium underline underline-offset-2"
              >
                browse
              </button>
            </p>
            <p className="mt-1 text-xs text-recoverpe-grey-medium">
              PDF, JPG, PNG up to 4MB
            </p>
          </>
        )}
      </div>

      {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-recoverpe-grey-medium">
          Attached Files ({attachments.length})
        </p>

        {isLoading ? (
          <p className="mt-3 text-sm text-recoverpe-grey-medium">Loading...</p>
        ) : attachments.length === 0 ? (
          <p className="mt-3 text-sm text-recoverpe-grey-medium">
            No evidence uploaded yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-recoverpe-grey-light border-y border-recoverpe-grey-light">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <EvidenceIcon fileType={attachment.file_type} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-recoverpe-black">
                      {attachment.file_name}
                    </p>
                    <p className="text-xs text-recoverpe-grey-medium">
                      {attachment.file_type} ·{" "}
                      {new Date(attachment.uploaded_at).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleOpenAttachment(attachment)}
                  disabled={openingId === attachment.id}
                  className="shrink-0 rounded-md border border-recoverpe-black px-3 py-1.5 text-xs font-medium text-recoverpe-black transition hover:bg-recoverpe-grey-light/40 disabled:opacity-60"
                >
                  {openingId === attachment.id ? "Opening..." : "View"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
