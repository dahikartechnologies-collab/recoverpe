import { waitUntil } from "@vercel/functions";
import {
  MetaStatusUpdate,
  applyWhatsAppDeliveryStatuses,
} from "@/lib/communication-logs";
import { captureHandledError } from "@/lib/observability";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { processInboundWhatsAppMessage } from "@/lib/whatsapp/inbound-payment-responder";
import { processInboundPaymentProof } from "@/lib/whatsapp/payment-proof";

export interface MetaInboundTextMessage {
  id?: string;
  from: string;
  type: string;
  text?: {
    body?: string;
  };
  image?: {
    id?: string;
    mime_type?: string;
  };
}

export interface MetaWebhookValue {
  messages?: MetaInboundTextMessage[];
  statuses?: MetaStatusUpdate[];
}

export interface MetaWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: MetaWebhookValue;
    }>;
  }>;
}

export function getWhatsAppWebhookValue(
  body: MetaWebhookBody
): MetaWebhookValue | null {
  return body.entry?.[0]?.changes?.[0]?.value ?? null;
}

export function isStatusOnlyWebhook(value: MetaWebhookValue): boolean {
  return Boolean(value.statuses?.length) && !value.messages?.length;
}

export function isSupportedInboundMessageType(
  type: string | undefined
): type is "text" | "image" {
  return type === "text" || type === "image";
}

export function inboundMessageHasWork(message: MetaInboundTextMessage): boolean {
  if (!message.from?.trim()) {
    return false;
  }

  if (message.type === "text") {
    return Boolean(message.text?.body?.trim());
  }

  if (message.type === "image") {
    return Boolean(message.image?.id?.trim());
  }

  return false;
}

/**
 * Keeps the serverless isolate alive after the HTTP response is sent so Meta
 * receives 200 before Gemini/media work. Local/dev still runs the promise.
 */
export function deferWhatsAppWebhookWork(work: Promise<unknown>): void {
  const tracked = work.catch((error) => {
    captureHandledError("whatsapp.webhook.deferred", error);
  });

  try {
    waitUntil(tracked);
  } catch {
    // Local Node has no request context; the process stays alive instead.
  }

  void tracked;
}

export async function applyInboundDeliveryStatuses(
  statuses: MetaStatusUpdate[]
): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const updated = await applyWhatsAppDeliveryStatuses(supabase, statuses);

  console.log("[WHATSAPP WEBHOOK STATUS]:", {
    received: statuses.length,
    updated,
  });
}

export async function executeInboundWhatsAppMessage(
  message: MetaInboundTextMessage
): Promise<void> {
  const rawFrom = message.from?.trim();

  if (!rawFrom) {
    return;
  }

  if (message.type === "image") {
    const mediaId = message.image?.id?.trim();

    if (mediaId) {
      await processInboundPaymentProof(
        rawFrom,
        mediaId,
        message.id ?? null
      );
    }

    return;
  }

  if (message.type !== "text") {
    return;
  }

  const messageText = message.text?.body?.trim() ?? "";

  if (!messageText) {
    return;
  }

  await processInboundWhatsAppMessage(rawFrom, messageText, {
    externalMessageId: message.id ?? null,
  });
}
