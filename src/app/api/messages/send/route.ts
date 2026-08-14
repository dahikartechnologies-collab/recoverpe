import { NextResponse } from "next/server";
import { ghostModeWriteBlockedResponse, resolveEffectiveUserContext } from "@/lib/api-auth";
import { fetchLedgerById } from "@/lib/ledger-queries";
import {
  draftWhatsAppReminderMessage,
  sendWhatsAppMessage,
} from "@/lib/whatsapp";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { Business, CommunicationLog, SendWhatsAppReminderPayload } from "@/types";

export async function POST(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const ghostBlocked = ghostModeWriteBlockedResponse(contextResult);

    if (ghostBlocked) {
      return ghostBlocked;
    }

    const body = (await request.json()) as SendWhatsAppReminderPayload;

    if (!body.ledger_id?.trim()) {
      return NextResponse.json({ error: "ledger_id is required." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const ledger = await fetchLedgerById(
      supabase,
      contextResult.effectiveUserId,
      body.ledger_id.trim()
    );

    if (!ledger) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    if (ledger.balance_due <= 0 || ["paid", "cancelled", "refunded"].includes(ledger.status)) {
      return NextResponse.json(
        { error: "This ledger is already settled and cannot receive reminders." },
        { status: 400 }
      );
    }

    let business: Pick<Business, "business_name"> | null = null;

    if (ledger.business_id) {
      const { data: businessData, error: businessError } = await supabase
        .from("businesses")
        .select("business_name")
        .eq("id", ledger.business_id)
        .eq("user_id", contextResult.effectiveUserId)
        .maybeSingle();

      if (businessError) {
        return NextResponse.json(
          { error: businessError.message || "Failed to load business profile." },
          { status: 500 }
        );
      }

      business = businessData as Pick<Business, "business_name"> | null;
    }

    const upiVpa =
      body.upi_vpa?.trim() ||
      process.env.DEFAULT_MERCHANT_UPI_VPA?.trim() ||
      null;

    const draft = draftWhatsAppReminderMessage({
      ledger,
      business,
      upiVpa,
    });

    const sendResult = await sendWhatsAppMessage(draft);

    const { data: communicationLog, error: logError } = await supabase
      .from("communication_logs")
      .insert({
        ledger_id: ledger.id,
        type: "whatsapp_reminder",
        status: "sent",
        cost_deducted: 0,
        executed_at: new Date().toISOString(),
      })
      .select("id, ledger_id, type, status, cost_deducted, executed_at")
      .single();

    if (logError || !communicationLog) {
      return NextResponse.json(
        { error: logError?.message || "Failed to log WhatsApp reminder." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      simulated: sendResult.simulated,
      message: sendResult.message,
      communication_log: communicationLog as CommunicationLog,
      draft: {
        to: draft.to,
        mode: draft.mode,
        body: draft.body,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send WhatsApp reminder.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
