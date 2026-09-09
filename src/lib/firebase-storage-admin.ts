import { getStorage } from "firebase-admin/storage";
import { getAdminAppInstance } from "@/lib/firebase-admin";
import {
  ledgerInvoiceStoragePath,
  ledgerLegalNoticeStoragePath,
  ledgerSamadhaanDocketStoragePath,
} from "@/lib/document-storage";
import { uploadEvidenceToFirebaseStorage } from "@/lib/firebase/storage";
import {
  MAX_PAYMENT_PROOF_BYTES,
  paymentProofExtension,
  resolveTrustedPaymentProofMimeType,
  type PaymentProofMimeType,
} from "@/lib/payment-proof-upload";

const SHORT_LIVED_SIGNED_URL_MS = 15 * 60 * 1000;

export function getStorageBucket() {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!bucketName) {
    return null;
  }

  return getStorage(getAdminAppInstance()).bucket(bucketName);
}

function requireStorageBucket() {
  const bucket = getStorageBucket();

  if (!bucket) {
    throw new Error("Firebase storage bucket is not configured.");
  }

  return bucket;
}

export async function createShortLivedSignedUrl(
  storagePath: string,
  expiresInMs: number = SHORT_LIVED_SIGNED_URL_MS
): Promise<string> {
  const file = requireStorageBucket().file(storagePath);
  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresInMs,
  });

  return signedUrl;
}

async function uploadSecurePdf(storagePath: string, pdfBuffer: Buffer): Promise<string> {
  const file = requireStorageBucket().file(storagePath);

  await file.save(pdfBuffer, {
    metadata: {
      contentType: "application/pdf",
    },
  });

  return storagePath;
}

export async function uploadSecureInvoicePdf(
  ledgerId: string,
  pdfBuffer: Buffer
): Promise<string> {
  return uploadSecurePdf(ledgerInvoiceStoragePath(ledgerId), pdfBuffer);
}

export const MAX_CUSTOM_PDF_BYTES = 4 * 1024 * 1024;

export function validateCustomPdfUpload(fileBuffer: Buffer): void {
  if (fileBuffer.byteLength > MAX_CUSTOM_PDF_BYTES) {
    throw new Error("PDF must be 4MB or smaller.");
  }

  const header = fileBuffer.subarray(0, 5).toString("utf8");

  if (!header.startsWith("%PDF-")) {
    throw new Error("Uploaded file must be a valid PDF document.");
  }
}

export async function uploadCustomLedgerPdf(
  ledgerId: string,
  pdfBuffer: Buffer
): Promise<string> {
  validateCustomPdfUpload(pdfBuffer);
  return uploadSecureInvoicePdf(ledgerId, pdfBuffer);
}

export async function uploadLegalNoticePdf(
  ledgerId: string,
  pdfBuffer: Buffer
): Promise<string> {
  return uploadSecurePdf(ledgerLegalNoticeStoragePath(ledgerId), pdfBuffer);
}

export async function uploadSamadhaanDocketPdf(
  ledgerId: string,
  pdfBuffer: Buffer
): Promise<string> {
  return uploadSecurePdf(ledgerSamadhaanDocketStoragePath(ledgerId), pdfBuffer);
}

export async function uploadPaymentProofScreenshot(
  ledgerId: string,
  fileBuffer: Buffer,
  contentType: PaymentProofMimeType
): Promise<string> {
  if (fileBuffer.byteLength > MAX_PAYMENT_PROOF_BYTES) {
    throw new Error("Payment proof must be 2MB or smaller.");
  }

  const trustedType = resolveTrustedPaymentProofMimeType({
    declaredType: contentType,
    fileBuffer,
  });

  if (!trustedType) {
    throw new Error(
      "Payment proof must be a JPEG, PNG, WEBP image, or PDF document."
    );
  }

  const extension = paymentProofExtension(trustedType);
  const filePath = `secure/payment-proofs/${ledgerId}/${Date.now()}.${extension}`;
  const file = requireStorageBucket().file(filePath);

  await file.save(fileBuffer, {
    metadata: { contentType: trustedType },
  });

  return filePath;
}

const MAX_EVIDENCE_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_EVIDENCE_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

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

export async function uploadEvidenceFile(
  ledgerId: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string,
  businessId: string | null,
  userId: string
): Promise<string> {
  const result = await uploadEvidenceToFirebaseStorage({
    businessId,
    userId,
    ledgerId,
    fileName,
    fileBuffer,
    contentType,
  });

  return result.storagePath;
}
