import { NextResponse } from "next/server";
import { processInboundWhatsAppMessage } from "@/lib/whatsapp/inbound-payment-responder";

export const dynamic = "force-dynamic";

interface MetaInboundTextMessage {
  from: string;
  type: string;
  text?: {
    body?: string;
  };
}

interface MetaWebhookBody {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: MetaInboundTextMessage[];
        statuses?: unknown[];
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
    console.log("[WHATSAPP WEBHOOK INCOMING]:", JSON.stringify(body, null, 2));

    const value = body?.entry?.[0]?.changes?.[0]?.value;

    if (!value) {
      return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    if (value.statuses?.length && !value.messages?.length) {
      return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    const message = value.messages?.[0];

    if (!message || message.type !== "text") {
      return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    const rawFrom = message.from;
    const messageText = message.text?.body?.trim() ?? "";

    if (!rawFrom) {
      return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    await processInboundWhatsAppMessage(rawFrom, messageText);
  } catch (error) {
    console.error(
      "[WHATSAPP WEBHOOK] Failed to process inbound message:",
      error instanceof Error ? error.message : error
    );
  }

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
