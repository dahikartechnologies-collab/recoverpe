import { randomUUID } from "crypto";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { getAdminAppInstance } from "@/lib/firebase-admin";
import { getStorage } from "firebase-admin/storage";

const MAX_EVIDENCE_FILE_BYTES = 4 * 1024 * 1024;

const ALLOWED_EVIDENCE_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export interface EvidenceUploadResult {
  storagePath: string;
  downloadUrl: string;
}

export function isFirebaseStorageConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim());
}

export function buildBusinessEvidenceStoragePath(
  businessId: string,
  ledgerId: string,
  fileName: string
): string {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  return `businesses/${businessId}/ledgers/${ledgerId}/${randomUUID()}_${safeFileName}`;
}

export function buildPersonalEvidenceStoragePath(
  userId: string,
  ledgerId: string,
  fileName: string
): string {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  return `users/${userId}/ledgers/${ledgerId}/${randomUUID()}_${safeFileName}`;
}

export function validateEvidenceUpload(
  fileBuffer: Buffer,
  contentType: string
): void {
  if (!ALLOWED_EVIDENCE_CONTENT_TYPES.has(contentType)) {
    throw new Error("Evidence file must be a PDF, JPG, or PNG.");
  }

  if (fileBuffer.byteLength > MAX_EVIDENCE_FILE_BYTES) {
    throw new Error("Evidence file must be 4MB or smaller.");
  }

  if (contentType === "application/pdf") {
    const header = fileBuffer.subarray(0, 5).toString("utf8");

    if (!header.startsWith("%PDF-")) {
      throw new Error("Uploaded PDF is not a valid document.");
    }
  }
}

function getStorageBucket() {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();

  if (!bucketName) {
    return null;
  }

  return getStorage(getAdminAppInstance()).bucket(bucketName);
}

export async function uploadEvidenceToFirebaseStorage(input: {
  businessId: string | null;
  userId: string;
  ledgerId: string;
  fileName: string;
  fileBuffer: Buffer;
  contentType: string;
}): Promise<EvidenceUploadResult> {
  validateEvidenceUpload(input.fileBuffer, input.contentType);

  const storagePath = input.businessId
    ? buildBusinessEvidenceStoragePath(
        input.businessId,
        input.ledgerId,
        input.fileName
      )
    : buildPersonalEvidenceStoragePath(
        input.userId,
        input.ledgerId,
        input.fileName
      );

  const bucket = getStorageBucket();

  if (!bucket) {
    if (isDevelopmentAppEnv()) {
      return {
        storagePath,
        downloadUrl: `https://mock.recoverpe.local/${storagePath}`,
      };
    }

    throw new Error("Firebase storage bucket is not configured.");
  }

  const file = bucket.file(storagePath);

  await file.save(input.fileBuffer, {
    metadata: { contentType: input.contentType },
  });

  const [downloadUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return {
    storagePath,
    downloadUrl,
  };
}

export function isMockEvidenceStoragePath(storagePath: string): boolean {
  return storagePath.startsWith("mock://");
}

export function buildMockEvidenceDownloadUrl(storagePath: string): string {
  return `https://mock.recoverpe.local/${storagePath}`;
}
