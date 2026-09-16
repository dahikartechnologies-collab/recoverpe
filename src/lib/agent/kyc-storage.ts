import { randomUUID } from "crypto";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { getAdminAppInstance } from "@/lib/firebase-admin";
import { getStorage } from "firebase-admin/storage";

const MAX_KYC_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_KYC_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);

export type KycDocumentSide = "front" | "back";

export interface AgentKycDocuments {
  front?: string;
  back?: string;
}

export function parseAgentKycDocuments(value: string | null | undefined): AgentKycDocuments {
  if (!value?.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as AgentKycDocuments;

    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    return { front: value };
  }

  return {};
}

export function serializeAgentKycDocuments(documents: AgentKycDocuments): string | null {
  const next = {
    ...(documents.front ? { front: documents.front } : {}),
    ...(documents.back ? { back: documents.back } : {}),
  };

  return Object.keys(next).length > 0 ? JSON.stringify(next) : null;
}

function getStorageBucket() {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();

  if (!bucketName) {
    return null;
  }

  return getStorage(getAdminAppInstance()).bucket(bucketName);
}

export function validateKycUpload(fileBuffer: Buffer, contentType: string): void {
  if (!ALLOWED_KYC_CONTENT_TYPES.has(contentType)) {
    throw new Error("KYC document must be a JPG, PNG, or PDF.");
  }

  if (fileBuffer.byteLength > MAX_KYC_FILE_BYTES) {
    throw new Error("KYC document must be 4MB or smaller.");
  }
}

export async function uploadAgentKycDocument(input: {
  agentId: string;
  side: KycDocumentSide;
  fileName: string;
  fileBuffer: Buffer;
  contentType: string;
}): Promise<string> {
  validateKycUpload(input.fileBuffer, input.contentType);

  const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `agents/${input.agentId}/kyc/${input.side}_${randomUUID()}_${safeFileName}`;
  const bucket = getStorageBucket();

  if (!bucket) {
    if (isDevelopmentAppEnv()) {
      return storagePath;
    }

    throw new Error("Document storage is not configured.");
  }

  const file = bucket.file(storagePath);

  await file.save(input.fileBuffer, {
    contentType: input.contentType,
    metadata: {
      cacheControl: "private, max-age=3600",
    },
  });

  return storagePath;
}
