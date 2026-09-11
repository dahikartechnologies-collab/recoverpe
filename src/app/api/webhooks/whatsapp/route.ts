import { NextResponse } from "next/server";
import { formatCurrency } from "@/lib/gst";
import { formatIndianPhoneNumber } from "@/lib/invoices";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";
import { SupabaseClient } from "@supabase/supabase-js";

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

interface ContactRow {
  id: string;
  user_id: string;
  name: string;
  phone_number: string;
}

interface LedgerRow {
  id: string;
  user_id: string;
  business_id: string | null;
  balance_due: number;
  created_at: string;
}

function buildPhoneLookupCandidates(rawFrom: string): string[] {
  const digits = rawFrom.replace(/\D/g, "");
  const last10 = digits.slice(-10);

  return Array.from(
    new Set(
      [
        formatIndianPhoneNumber(rawFrom),
        formatIndianPhoneNumber(last10),
        `+91${last10}`,
        `91${last10}`,
        last10,
        digits,
      ].filter(Boolean)
    )
  );
}

function getInboundAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return "https://www.recoverpe.com";
}

async function resolveBusinessName(
  supabase: SupabaseClient,
  userId: string,
  businessId: string | null
): Promise<string> {
  if (businessId) {
    const { data } = await supabase
      .from("businesses")
      .select("business_name")
      .eq("id", businessId)
      .maybeSingle();

    if (data?.business_name) {
      return data.business_name as string;
    }
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("business_name")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (business?.business_name) {
    return business.business_name as string;
  }

  const { data: user } = await supabase
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();

  return (user?.email as string | undefined)?.split("@")[0] ?? "RecoverPe";
}

async function findContactAndUnpaidLedger(
  supabase: SupabaseClient,
  rawFrom: string
): Promise<{ contact: ContactRow; ledger: LedgerRow | null } | null> {
  const phoneCandidates = buildPhoneLookupCandidates(rawFrom);

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, user_id, name, phone_number")
    .in("phone_number", phoneCandidates);

  if (error) {
    throw new Error(error.message || "Failed to lookup contact by phone.");
  }

  if (!contacts?.length) {
    return null;
  }

  let bestMatch: { contact: ContactRow; ledger: LedgerRow } | null = null;

  for (const contact of contacts as ContactRow[]) {
    const ledger = await findLatestUnpaidLedger(supabase, contact.id);

    if (!ledger) {
      continue;
    }

    if (
      !bestMatch ||
      ledger.created_at > bestMatch.ledger.created_at
    ) {
      bestMatch = { contact, ledger };
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  return { contact: contacts[0] as ContactRow, ledger: null };
}

async function findLatestUnpaidLedger(
  supabase: SupabaseClient,
  contactId: string
): Promise<LedgerRow | null> {
  const { data, error } = await supabase
    .from("ledgers")
    .select("id, user_id, business_id, balance_due, created_at")
    .eq("contact_id", contactId)
    .gt("balance_due", 0)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to lookup unpaid ledger.");
  }

  return (data as LedgerRow | null) ?? null;
}

function buildUnpaidLedgerReply(input: {
  contactName: string;
  businessName: string;
  ledgerId: string;
  balanceDue: number;
  appUrl: string;
}): string {
  return [
    `Hello ${input.contactName},`,
    "",
    `Here is your direct payment link for ${input.businessName}:`,
    `👉 ${input.appUrl}/pay/${input.ledgerId}`,
    "",
    `• Outstanding Amount: ${formatCurrency(input.balanceDue)}`,
    "• Supported modes: UPI (GPay, PhonePe, Paytm), Netbanking, and Cards.",
    "",
    "Your payment will automatically update your ledger statement.",
    "- RecoverPe",
  ].join("\n");
}

function buildNoPendingDuesReply(input: {
  contactName: string;
  businessName: string;
  appUrl: string;
}): string {
  return [
    `Hello ${input.contactName},`,
    "",
    `You currently have no pending dues with ${input.businessName}. All prior bills are clear!`,
    "",
    "View your account summary:",
    `👉 ${input.appUrl}/portal`,
    "",
    "- RecoverPe",
  ].join("\n");
}

function buildUnrecognizedNumberReply(appUrl: string): string {
  return [
    "Hello! This is an automated notification service from RecoverPe.",
    "",
    "If you need to make a payment or view your statement, please visit:",
    `👉 ${appUrl}`,
    "",
    "For help, contact your merchant directly.",
  ].join("\n");
}

async function processInboundWhatsAppMessage(rawFrom: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const appUrl = getInboundAppUrl();
  const match = await findContactAndUnpaidLedger(supabase, rawFrom);

  if (!match) {
    await sendWhatsAppTextMessage(rawFrom, buildUnrecognizedNumberReply(appUrl));
    return;
  }

  const { contact, ledger } = match;
  const businessName = await resolveBusinessName(
    supabase,
    contact.user_id,
    ledger?.business_id ?? null
  );

  if (ledger) {
    await sendWhatsAppTextMessage(
      rawFrom,
      buildUnpaidLedgerReply({
        contactName: contact.name,
        businessName,
        ledgerId: ledger.id,
        balanceDue: Number(ledger.balance_due),
        appUrl,
      })
    );
    return;
  }

  await sendWhatsAppTextMessage(
    rawFrom,
    buildNoPendingDuesReply({
      contactName: contact.name,
      businessName,
      appUrl,
    })
  );
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

    if (!rawFrom) {
      return new NextResponse("EVENT_RECEIVED", { status: 200 });
    }

    await processInboundWhatsAppMessage(rawFrom);
  } catch (error) {
    console.error(
      "[WHATSAPP WEBHOOK] Failed to process inbound message:",
      error instanceof Error ? error.message : error
    );
  }

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
