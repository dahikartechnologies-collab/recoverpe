import { NextResponse } from "next/server";
import {
  MetaStatusUpdate,
  applyWhatsAppDeliveryStatuses,
} from "@/lib/communication-logs";
import { captureHandledError } from "@/lib/observability";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { processInboundWhatsAppMessage } from "@/lib/whatsapp/inbound-payment-responder";
import { processInboundPaymentProof } from "@/lib/whatsapp/payment-proof";
import {
  readMetaSignatureHeader,
  verifyMetaWebhookSignature,
} from "@/lib/whatsapp/verify-signature";

export const dynamic = "force-dynamic";
// Image intake downloads media from Meta and then runs vision inference, which
// comfortably exceeds the default function ceiling.
export const maxDuration = 60;

interface MetaInboundTextMessage {
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

interface MetaWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: MetaInboundTextMessage[];
        statuses?: MetaStatusUpdate[];
      };
    }>;
  }>;
}

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
    console.error("[WHATSAPP WEBHOOK] Rejected payload:", signature.reason);

    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const body = JSON.parse(rawBody) as MetaWebhookBody;

    const value = body?.entry?.[0]?.changes?.[0]?.value;

    if (!value) {
      return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    if (value.statuses?.length) {
      const supabase = createAdminSupabaseClient();
      const updated = await applyWhatsAppDeliveryStatuses(
        supabase,
        value.statuses
      );

      console.log("[WHATSAPP WEBHOOK STATUS]:", {
        received: value.statuses.length,
        updated,
      });

      if (!value.messages?.length) {
        return new NextResponse("EVENT_RECEIVED", { status: 200 });
      }
    }

    const message = value.messages?.[0];

    if (!message) {
      return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    // Identifier and type only. The rest of the Meta payload carries the
    // customer's phone number, profile name and message body.
    console.log("[WHATSAPP WEBHOOK INCOMING]:", {
      message_id: message.id,
      type: message.type,
    });

    const rawFrom = message.from;

    if (!rawFrom) {
      return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    if (message.type === "image") {
      const mediaId = message.image?.id;

      if (mediaId) {
        await processInboundPaymentProof(
          rawFrom,
          mediaId,
          message.id ?? null
        );
      }

      return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    if (message.type !== "text") {
      return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    const messageText = message.text?.body?.trim() ?? "";

    await processInboundWhatsAppMessage(rawFrom, messageText, {
      externalMessageId: message.id ?? null,
    });
  } catch (error) {
    // Meta retries non-200 responses, which would re-run inference and re-reply
    // to the customer, so the failure is absorbed and reported instead.
    captureHandledError("whatsapp.webhook", error);
  }

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
