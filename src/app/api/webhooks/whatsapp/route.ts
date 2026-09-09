import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
  // Acknowledge receipt of messages instantly so Meta doesn't retry
  try {
    const body = await request.json();
    console.log("[WHATSAPP WEBHOOK INCOMING]:", JSON.stringify(body, null, 2));
  } catch (e) {
    console.error("Failed to parse WhatsApp webhook body");
  }
  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
