export const MAX_PAYMENT_PROOF_BYTES = 2 * 1024 * 1024;

export const ALLOWED_PAYMENT_PROOF_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type PaymentProofMimeType = (typeof ALLOWED_PAYMENT_PROOF_MIME_TYPES)[number];

const ALLOWED_PAYMENT_PROOF_SET = new Set<string>(ALLOWED_PAYMENT_PROOF_MIME_TYPES);

export function isAllowedPaymentProofMimeType(
  value: string
): value is PaymentProofMimeType {
  return ALLOWED_PAYMENT_PROOF_SET.has(value);
}

/** Sniff the true MIME from magic bytes — never trust the client Content-Type alone. */
export function detectPaymentProofMimeType(
  fileBuffer: Buffer
): PaymentProofMimeType | null {
  if (fileBuffer.length < 5) {
    return null;
  }

  if (fileBuffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }

  if (fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    fileBuffer[0] === 0x89 &&
    fileBuffer[1] === 0x50 &&
    fileBuffer[2] === 0x4e &&
    fileBuffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (fileBuffer.length < 12) {
    return null;
  }

  if (
    fileBuffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    fileBuffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export function resolveTrustedPaymentProofMimeType(input: {
  declaredType: string;
  fileBuffer: Buffer;
}): PaymentProofMimeType | null {
  const detected = detectPaymentProofMimeType(input.fileBuffer);

  if (!detected) {
    return null;
  }

  const declared = input.declaredType.trim().toLowerCase();

  if (declared && declared !== detected) {
    return null;
  }

  return detected;
}

export function paymentProofExtension(contentType: PaymentProofMimeType): string {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "jpg";
  }
}
