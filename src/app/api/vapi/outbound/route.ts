import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import {
  fetchBusinessUsageMeteringRow,
  isUnlimitedQuota,
} from "@/lib/business-usage-metering";
import { hasEntitlement } from "@/lib/entitlements";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { canInitiateAiCallForLedger } from "@/lib/ledger-status";
import { enforceVapiCallRateLimit } from "@/lib/rate-limit";
import { getTraiCurfewMessage, isTraiCurfewActive } from "@/lib/trai-curfew";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import {
  draftVapiCall,
  initiateVapiOutboundCall,
  TraiCurfewError,
} from "@/lib/vapi";
import { Business, CommunicationLog } from "@/types";

interface VapiOutboundPayload {
  ledgerId?: string;
  ledger_id?: string;
}

export const POST = withWorkspaceMutation(async (request, auth) => {
  try {
    if (isTraiCurfewActive()) {
      return NextResponse.json({ error: getTraiCurfewMessage() }, { status: 403 });
    }

    const rateLimitResponse = await enforceVapiCallRateLimit(auth.effectiveUserId);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = (await request.json()) as VapiOutboundPayload;
    const ledgerId = (body.ledgerId ?? body.ledger_id ?? "").trim();

    if (!ledgerId) {
      return NextResponse.json({ error: "ledgerId is required." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const ledger = await fetchLedgerById(
      supabase,
      auth.effectiveUserId,
      ledgerId
    );

    if (!ledger) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    if (!canInitiateAiCallForLedger(ledger)) {
      return NextResponse.json(
        {
          error:
            "AI voice calls require an overdue business ledger with an outstanding balance.",
        },
        { status: 400 }
      );
    }

    if (!ledger.business_id) {
      return NextResponse.json(
        { error: "AI voice calls require a business ledger." },
        { status: 400 }
      );
    }

    const [{ data: business, error: businessError }, { data: userRow, error: userError }] =
      await Promise.all([
        supabase
          .from("businesses")
          .select(
            "id, business_name, subscription_tier, subscription_status, addons, quota_vapi_minutes, usage_vapi_minutes"
          )
          .eq("id", ledger.business_id)
          .eq("user_id", auth.effectiveUserId)
          .maybeSingle(),
        supabase
          .from("users")
          .select("id, phone_number")
          .eq("id", auth.effectiveUserId)
          .single(),
      ]);

    if (businessError || !business) {
      return NextResponse.json(
        { error: businessError?.message || "Business profile not found." },
        { status: 404 }
      );
    }

    if (userError || !userRow) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const businessEntitlements = {
      subscription_tier: business.subscription_tier,
      subscription_status: business.subscription_status,
      addons: business.addons,
    };

    if (!hasEntitlement(businessEntitlements, "ai_voice_calls")) {
      return NextResponse.json(
        {
          error:
            "AI Voice Calls are available on Premium. Upgrade in Billing to unlock outbound recovery calls.",
          upgrade_required: true,
        },
        { status: 403 }
      );
    }

    const usageRow = await fetchBusinessUsageMeteringRow(
      supabase,
      ledger.business_id
    );

    if (
      usageRow &&
      !isUnlimitedQuota(usageRow.quota_vapi_minutes) &&
      usageRow.usage_vapi_minutes >= usageRow.quota_vapi_minutes
    ) {
      return NextResponse.json(
        {
          error:
            "Your included AI voice minutes for this billing period are exhausted. Upgrade or wait for the next cycle.",
        },
        { status: 402 }
      );
    }

    const draft = draftVapiCall({
      ledger,
      business: business as Pick<Business, "business_name">,
      userId: auth.effectiveUserId,
      ownerPhoneNumber: userRow.phone_number ?? null,
    });

    const callResult = await initiateVapiOutboundCall(draft);

    const { data: communicationLog, error: logError } = await supabase
      .from("communication_logs")
      .insert({
        user_id: auth.effectiveUserId,
        business_id: ledger.business_id,
        contact_id: ledger.contact_id,
        ledger_id: ledger.id,
        type: "vapi_call",
        channel: "voice_ai",
        direction: "outbound",
        status: "sent",
        summary: "AI voice recovery call initiated",
        cost_deducted: 0,
        vapi_call_id: callResult.vapi_call_id ?? null,
        executed_at: new Date().toISOString(),
      })
      .select(
        "id, ledger_id, user_id, business_id, contact_id, channel, direction, external_message_id, summary, type, status, cost_deducted, executed_at, vapi_call_id, recording_url, sentiment, executive_summary, duration_seconds"
      )
      .single();

    if (logError || !communicationLog) {
      return NextResponse.json(
        { error: logError?.message || "Failed to log AI voice call." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      simulated: callResult.simulated,
      message: callResult.message,
      vapi_call_id: callResult.vapi_call_id ?? null,
      communication_log: communicationLog as CommunicationLog,
      draft: {
        customer_number: draft.customer_number,
        context: draft.context,
        system_prompt: draft.system_prompt,
        first_message: draft.first_message,
      },
    });
  } catch (error) {
    if (error instanceof TraiCurfewError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const message =
      error instanceof Error ? error.message : "Failed to initiate AI voice call.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { permission: "spend_funds" });
