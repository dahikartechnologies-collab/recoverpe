import { NextResponse } from "next/server";
import { captureHandledError } from "@/lib/observability";
import { claimWhatsAppWamid } from "@/lib/whatsapp/wamid-idempotency";
import {
  MetaInboundTextMessage,
  MetaWebhookBody,
  applyInboundDeliveryStatuses,
  deferWhatsAppWebhookWork,
  executeInboundWhatsAppMessage,
  getWhatsAppWebhookValue,
  inboundMessageHasWork,
  isStatusOnlyWebhook,
  isSupportedInboundMessageType,
} from "@/lib/whatsapp/webhook-inbound";
import {
  readMetaSignatureHeader,
  verifyMetaWebhookSignature,
} from "@/lib/whatsapp/verify-signature";

export const dynamic = "force-dynamic";
// Image intake downloads media from Meta and then runs vision inference, which
// comfortably exceeds the default function ceiling.
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const myVerifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN?.trim();

  if (!myVerifyToken) {
    console.error(
      "[WHATSAPP WEBHOOK] META_WHATSAPP_VERIFY_TOKEN is not configured."
    );
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (mode === "subscribe" && token === myVerifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  // Read the body as text and verify before parsing: an unsigned payload must
  // never reach the handlers that create reconciliations or send messages.
  const rawBody = await request.text();
  const signature = verifyMetaWebhookSignature(
    rawBody,
    readMetaSignatureHeader(request)
  );

  if (!signature.ok) {
    if (signature.reason === "not_configured") {
      console.error(
        "[WHATSAPP WEBHOOK] Configure META_APP_SECRET in Vercel before accepting signed payloads."
      );
    }

    console.error("[WHATSAPP WEBHOOK] Rejected payload:", signature.reason);

    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const body = JSON.parse(rawBody) as MetaWebhookBody;
    const value = getWhatsAppWebhookValue(body);

    if (!value) {
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    // Delivery receipts must never reach Gemini. Apply synchronously, then ack.
    if (value.statuses?.length) {
      await applyInboundDeliveryStatuses(value.statuses ?? []);
    }

    if (isStatusOnlyWebhook(value)) {
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const messages = value.messages ?? [];
    const claimedMessages: MetaInboundTextMessage[] = [];
    let sawDuplicate = false;

    for (const message of messages) {
      if (!isSupportedInboundMessageType(message.type)) {
        continue;
      }

      if (!inboundMessageHasWork(message)) {
        continue;
      }

      const wamid = message.id?.trim();

      if (!wamid) {
        continue;
      }

      // Identifier and type only. The rest of the Meta payload carries the
      // customer's phone number, profile name and message body.
      console.log("[WHATSAPP WEBHOOK INCOMING]:", {
        message_id: wamid,
        type: message.type,
      });

      const exists = await claimWhatsAppWamid(wamid);

      if (!exists) {
        sawDuplicate = true;
        continue;
      }

      claimedMessages.push(message);
    }

    if (claimedMessages.length === 0) {
      if (sawDuplicate) {
        return NextResponse.json(
          { status: "already_processed" },
          { status: 200 }
        );
      }

      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    deferWhatsAppWebhookWork(
      Promise.all(
        claimedMessages.map((message) => executeInboundWhatsAppMessage(message))
      )
    );
  } catch (error) {
    // Meta retries non-200 responses, which would re-run inference and re-reply
    // to the customer, so the failure is absorbed and reported instead.
    captureHandledError("whatsapp.webhook", error);
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
