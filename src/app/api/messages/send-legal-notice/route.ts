import { NextResponse } from "next/server";
import { ghostModeWriteBlockedResponse, resolveEffectiveUserContext } from "@/lib/api-auth";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { dispatchOmnichannelMessage } from "@/lib/notifications/dispatcher";
import {
  assertWorkspacePermission,
  resolveWorkspaceAccess,
} from "@/lib/workspace-rbac";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { SendLegalNoticeWhatsAppPayload } from "@/types";

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

    const access = await resolveWorkspaceAccess(
      contextResult.actorUserId,
      contextResult.effectiveUserId
    );

    try {
      assertWorkspacePermission(
        access,
        "send_reminders",
        "You do not have permission to send legal notices."
      );
    } catch (permissionError) {
      return NextResponse.json(
        {
          error:
            permissionError instanceof Error
              ? permissionError.message
              : "Forbidden.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as SendLegalNoticeWhatsAppPayload;

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

    if (!ledger.legal_notice_pdf_url) {
      return NextResponse.json(
        { error: "Generate a legal notice PDF before sending." },
        { status: 400 }
      );
    }

    const dispatchResult = await dispatchOmnichannelMessage({
      supabase,
      userId: contextResult.effectiveUserId,
      businessId: ledger.business_id,
      contactId: ledger.contact_id,
      ledgerId: ledger.id,
      options: { isLegalNotice: true },
    });

    if (!dispatchResult.success) {
      return NextResponse.json(
        { error: dispatchResult.message },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      simulated: dispatchResult.simulated ?? false,
      message: dispatchResult.message,
      channel: dispatchResult.channel,
      fallbackTriggered: dispatchResult.fallbackTriggered ?? false,
      communication_type: dispatchResult.communicationType,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to send legal notice.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
