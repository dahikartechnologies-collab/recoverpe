import { NextResponse } from "next/server";
import { ghostModeWriteBlockedResponse, resolveEffectiveUserContext } from "@/lib/api-auth";
import {
  entitlementForbiddenResponse,
  fetchBusinessEntitlementRow,
  requireEntitlementAccess,
} from "@/lib/entitlement-gate";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { dispatchOmnichannelMessage } from "@/lib/notifications/dispatcher";
import {
  assertWorkspacePermission,
  resolveWorkspaceAccess,
} from "@/lib/workspace-rbac";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { SendWhatsAppReminderPayload } from "@/types";

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
        "You do not have permission to send reminders."
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

    if (
      ledger.balance_due <= 0 ||
      ["paid", "cancelled", "refunded"].includes(ledger.status)
    ) {
      return NextResponse.json(
        { error: "This ledger is already settled and cannot receive reminders." },
        { status: 400 }
      );
    }

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", contextResult.effectiveUserId)
      .single();

    if (userError || !userRow) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    if (ledger.business_id) {
      const businessEntitlement = await fetchBusinessEntitlementRow(
        supabase,
        ledger.business_id,
        contextResult.effectiveUserId
      );
      const denied = requireEntitlementAccess(
        businessEntitlement,
        "whatsapp_reminders",
        "Upgrade to Starter or above to send automated WhatsApp reminders."
      );

      if (denied) {
        return denied;
      }
    }

    const dispatchResult = await dispatchOmnichannelMessage({
      supabase,
      userId: contextResult.effectiveUserId,
      businessId: ledger.business_id,
      contactId: ledger.contact_id,
      ledgerId: ledger.id,
      messagePayload: {},
    });

    if (!dispatchResult.success) {
      if (
        dispatchResult.error?.includes("Upgrade to Starter") ||
        dispatchResult.message.includes("Upgrade to Starter")
      ) {
        return entitlementForbiddenResponse(dispatchResult.message);
      }

      return NextResponse.json(
        { error: dispatchResult.message },
        { status: 422 }
      );
    }

    const { data: communicationLog } = await supabase
      .from("communication_logs")
      .select("id, ledger_id, type, status, cost_deducted, executed_at")
      .eq("ledger_id", ledger.id)
      .order("executed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      simulated: dispatchResult.simulated ?? false,
      message: dispatchResult.message,
      channel: dispatchResult.channel,
      fallbackTriggered: dispatchResult.fallbackTriggered ?? false,
      communication_type: dispatchResult.communicationType,
      communication_log: communicationLog ?? undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send reminder.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
