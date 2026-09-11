import { createHmac, timingSafeEqual } from "crypto";

const SIGNATURE_HEADER = "x-hub-signature-256";
const SIGNATURE_PREFIX = "sha256=";

export type WebhookSignatureResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "missing_signature" | "mismatch" };

/**
 * Meta signs the raw request body with the app secret. The body must be read as
 * text and hashed byte-for-byte — re-serialising the parsed JSON changes key
 * order and whitespace, which breaks the digest.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): WebhookSignatureResult {
  const appSecret = process.env.META_APP_SECRET?.trim();

  if (!appSecret) {
    return { ok: false, reason: "not_configured" };
  }

  if (!signatureHeader?.startsWith(SIGNATURE_PREFIX)) {
    return { ok: false, reason: "missing_signature" };
  }

  const expected = Buffer.from(
    createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex"),
    "utf8"
  );
  const received = Buffer.from(
    signatureHeader.slice(SIGNATURE_PREFIX.length).trim(),
    "utf8"
  );

  if (expected.length !== received.length) {
    return { ok: false, reason: "mismatch" };
  }

  return timingSafeEqual(expected, received)
    ? { ok: true }
    : { ok: false, reason: "mismatch" };
}

export function readMetaSignatureHeader(request: Request): string | null {
  return request.headers.get(SIGNATURE_HEADER);
}
