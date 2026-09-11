import { NextResponse } from "next/server";
import {
  MetaStatusUpdate,
  applyWhatsAppDeliveryStatuses,
} from "@/lib/communication-logs";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { processInboundWhatsAppMessage } from "@/lib/whatsapp/inbound-payment-responder";
import { processInboundPaymentProof } from "@/lib/whatsapp/payment-proof";

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

  const myVerifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === myVerifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MetaWebhookBody;

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
    console.error(
      "[WHATSAPP WEBHOOK] Failed to process inbound message:",
      error instanceof Error ? error.message : error
    );
  }

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
