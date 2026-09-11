import { SupabaseClient } from "@supabase/supabase-js";
import {
  getDefaultGeminiModel,
  getVertexAI,
} from "@/lib/firebase-admin-vertexai";
import { recordCommunicationSafely } from "@/lib/communication-logs";
import { uploadWhatsAppPaymentProof } from "@/lib/firebase-storage-admin";
import { captureHandledError } from "@/lib/observability";
import { resilientFetch, retryAsync } from "@/lib/resilient-fetch";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import {
  BusinessDebtScope,
  findBusinessDebtScopes,
} from "@/lib/whatsapp/inbound-payment-responder";

const META_GRAPH_VERSION = "v19.0";
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const VISION_PROMPT =
  'Extract the UTR / Transaction ID, Amount, and Date from this payment screenshot. Return ONLY valid JSON matching this exact schema: { "utr": string | null, "amount": number | null, "date": string | null, "confidence": "high" | "medium" | "low" }. If not a payment proof, return null values.';

const ACKNOWLEDGEMENT_FALLBACK =
  "We received your payment proof. Our accounts team has logged this and will reconcile your ledger shortly. Thank you! - RecoverPe";

export interface PaymentProofExtraction {
  utr: string | null;
  amount: number | null;
  date: string | null;
  confidence: "high" | "medium" | "low";
}

export interface WhatsAppMediaPayload {
  base64: string;
  mimeType: string;
  buffer: Buffer;
}

/**
 * Meta serves media in two hops: a metadata lookup that returns a short-lived
 * URL, then a download of that URL. Both require the bearer token.
 */
export async function fetchWhatsAppMedia(
  mediaId: string
): Promise<WhatsAppMediaPayload | null> {
  try {
    return await downloadWhatsAppMedia(mediaId);
  } catch (error) {
    captureHandledError("whatsapp.media_download", error, { media_id: mediaId });
    return null;
  }
}

async function downloadWhatsAppMedia(
  mediaId: string
): Promise<WhatsAppMediaPayload | null> {
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    console.error("[WHATSAPP MEDIA] Missing Meta access token.");
    return null;
  }

  // Meta's media URL expires within minutes, so a hung or flaky download must
  // fail fast and retry rather than burn the whole window on one attempt.
  const metadataResponse = await resilientFetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${mediaId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { scope: "WHATSAPP MEDIA META", timeoutMs: 8_000, maxAttempts: 3 }
  );

  if (!metadataResponse.ok) {
    console.error(
      "[WHATSAPP MEDIA] Metadata lookup failed:",
      metadataResponse.status,
      await metadataResponse.text()
    );
    return null;
  }

  const metadata = (await metadataResponse.json()) as {
    url?: string;
    mime_type?: string;
    file_size?: number;
  };

  if (!metadata.url) {
    console.error("[WHATSAPP MEDIA] Metadata response contained no URL.");
    return null;
  }

  const mimeType = metadata.mime_type?.split(";")[0]?.trim() ?? "image/jpeg";

  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    console.error("[WHATSAPP MEDIA] Unsupported media type:", mimeType);
    return null;
  }

  if (metadata.file_size && metadata.file_size > MAX_MEDIA_BYTES) {
    console.error("[WHATSAPP MEDIA] Media exceeds size ceiling:", metadata.file_size);
    return null;
  }

  const binaryResponse = await resilientFetch(
    metadata.url,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { scope: "WHATSAPP MEDIA BINARY", timeoutMs: 15_000, maxAttempts: 3 }
  );

  if (!binaryResponse.ok) {
    console.error(
      "[WHATSAPP MEDIA] Binary download failed:",
      binaryResponse.status
    );
    return null;
  }

  const arrayBuffer = await binaryResponse.arrayBuffer();

  // file_size is advisory, so enforce the ceiling against the real payload too.
  if (arrayBuffer.byteLength > MAX_MEDIA_BYTES) {
    console.error(
      "[WHATSAPP MEDIA] Downloaded media exceeds size ceiling:",
      arrayBuffer.byteLength
    );
    return null;
  }

  const buffer = Buffer.from(arrayBuffer);

  return {
    base64: buffer.toString("base64"),
    mimeType,
    buffer,
  };
}

export function parsePaymentProofExtraction(
  raw: string
): PaymentProofExtraction | null {
  // Models still fence JSON in markdown even when told not to.
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as
      | Record<string, unknown>
      | null;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const amount = Number(parsed.amount);
    const confidence =
      parsed.confidence === "high" || parsed.confidence === "medium"
        ? parsed.confidence
        : "low";

    return {
      utr:
        typeof parsed.utr === "string" && parsed.utr.trim()
          ? parsed.utr.trim()
          : null,
      amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      date:
        typeof parsed.date === "string" && parsed.date.trim()
          ? parsed.date.trim()
          : null,
      confidence,
    };
  } catch {
    return null;
  }
}

export async function extractPaymentProof(
  media: WhatsAppMediaPayload
): Promise<{ extraction: PaymentProofExtraction | null; raw: string | null }> {
  const modelId = getDefaultGeminiModel();

  try {
    // Vertex returns 429/503 under burst load. A dropped extraction means the
    // reviewer has to key the UTR in by hand, so a couple of retries are worth
    // the added latency on a background webhook path.
    const result = await retryAsync(
      () =>
        getVertexAI()
          .getGenerativeModel({ model: modelId })
          .generateContent(
            [
              { inlineData: { mimeType: media.mimeType, data: media.base64 } },
              { text: VISION_PROMPT },
            ],
            { responseMimeType: "application/json", temperature: 0 }
          ),
      { scope: "VERTEX VISION", maxAttempts: 3, baseDelayMs: 800 }
    );

    const raw = result.response.text().trim();

    return { extraction: parsePaymentProofExtraction(raw), raw };
  } catch (error) {
    // A vision failure still produces a reviewable claim, so it is reported
    // rather than thrown — but silent degradation here means every claim
    // arrives blank, which must be visible in alerting.
    captureHandledError("vertex.payment_proof_vision", error, { model: modelId });
    return { extraction: null, raw: null };
  }
}

/**
 * Only the ISO date the model returns is trusted into a DATE column; anything
 * else is kept in raw_extraction for the reviewer to read.
 */
function toDateColumnValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function buildPaymentProofReply(
  extraction: PaymentProofExtraction | null
): string {
  if (!extraction?.utr && !extraction?.amount) {
    return ACKNOWLEDGEMENT_FALLBACK;
  }

  const utrText = extraction.utr ?? "not detected";
  const amountText =
    extraction.amount !== null
      ? `Rs. ${extraction.amount.toLocaleString("en-IN")}`
      : "not detected";

  return `We received your payment proof (UTR: ${utrText}, Amount: ${amountText}). Our accounts team has logged this and will reconcile your ledger shortly. Thank you! - RecoverPe`;
}

async function recordReconciliation(
  supabase: SupabaseClient,
  scope: BusinessDebtScope,
  input: {
    externalMessageId: string | null;
    mediaId: string;
    proofUrl: string | null;
    extraction: PaymentProofExtraction | null;
    raw: string | null;
  }
): Promise<void> {
  // Oldest unpaid invoice is the likeliest target, but an owner still approves.
  const primaryLedgerId = scope.unpaidLedgers[0]?.id ?? null;

  const { error } = await supabase.from("reconciliations").insert({
    user_id: scope.contact.user_id,
    business_id: scope.businessId,
    contact_id: scope.contact.id,
    ledger_id: primaryLedgerId,
    external_message_id: input.externalMessageId,
    media_id: input.mediaId,
    proof_url: input.proofUrl,
    source: "whatsapp",
    extracted_utr: input.extraction?.utr ?? null,
    extracted_amount: input.extraction?.amount ?? null,
    extracted_date: toDateColumnValue(input.extraction?.date ?? null),
    raw_extraction: {
      model_output: input.raw,
      confidence: input.extraction?.confidence ?? null,
    },
    status: "pending_review",
  });

  if (!error) {
    return;
  }

  // 23505 is the idempotency keys doing their job: the same wamid or the same
  // UTR was already claimed for this merchant. Re-sending a screenshot is
  // normal customer behaviour, not a failure worth alerting on.
  if (error.code === "23505") {
    console.log(
      "[RECONCILIATION] Duplicate claim ignored for user:",
      scope.contact.user_id
    );
    return;
  }

  console.error("[RECONCILIATION] Failed to record claim:", error.message);
}

export async function processInboundPaymentProof(
  rawFrom: string,
  mediaId: string,
  externalMessageId: string | null = null
): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const scopes = await findBusinessDebtScopes(supabase, rawFrom);

  if (scopes.length === 0) {
    console.log("[RECONCILIATION] Payment proof from unrecognised number.");
    return;
  }

  const media = await fetchWhatsAppMedia(mediaId);

  if (!media) {
    await sendWhatsAppTextMessage(rawFrom, ACKNOWLEDGEMENT_FALLBACK);
    return;
  }

  // Retain the image before inference. Meta's URL is dead within minutes, and a
  // reviewer approving a settlement needs to see what the customer actually
  // sent — an extraction failure must not also lose the evidence.
  let proofUrl: string | null = null;

  try {
    proofUrl = await uploadWhatsAppPaymentProof(
      scopes[0].contact.id,
      media.buffer,
      media.mimeType
    );
  } catch (uploadError) {
    // Losing the image does not block the claim, but the reviewer will be
    // approving blind — that degradation needs to page someone.
    captureHandledError("reconciliation.proof_upload", uploadError, {
      contact_id: scopes[0].contact.id,
    });
  }

  const { extraction, raw } = await extractPaymentProof(media);

  // One claim per merchant the customer owes: we cannot tell from a screenshot
  // which of them was actually paid, and each owner reviews their own.
  for (const scope of scopes) {
    await recordReconciliation(supabase, scope, {
      externalMessageId,
      mediaId,
      proofUrl,
      extraction,
      raw,
    });

    await recordCommunicationSafely(supabase, {
      userId: scope.contact.user_id,
      businessId: scope.businessId,
      contactId: scope.contact.id,
      type: "whatsapp_reminder",
      channel: "whatsapp",
      direction: "inbound",
      status: "delivered",
      externalMessageId,
      summary: extraction?.utr
        ? `Payment proof received (UTR ${extraction.utr})`
        : "Payment proof image received",
    });
  }

  await sendWhatsAppTextMessage(rawFrom, buildPaymentProofReply(extraction));
}
