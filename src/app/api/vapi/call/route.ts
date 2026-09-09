import { NextResponse } from "next/server";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { canInitiateAiCallForLedger } from "@/lib/ledger-status";
import { enforceVapiCallRateLimit } from "@/lib/rate-limit";
import { getTraiCurfewMessage, isTraiCurfewActive } from "@/lib/trai-curfew";
import {
  draftVapiCall,
  initiateVapiOutboundCall,
  TraiCurfewError,
  VAPI_CALL_CREDIT_COST,
} from "@/lib/vapi";
import { refundVapiCredits, reserveVapiCredits } from "@/lib/vapi-wallet";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { Business, CommunicationLog, InitiateVapiCallPayload } from "@/types";

export const POST = withWorkspaceMutation(async (request, auth) => {
  let reservedCredits = false;
  const effectiveUserId = auth.effectiveUserId;
  let supabase: ReturnType<typeof createAdminSupabaseClient> | null = null;
  const isDevelopment = isDevelopmentAppEnv();

  try {
    if (isTraiCurfewActive()) {
      return NextResponse.json({ error: getTraiCurfewMessage() }, { status: 403 });
    }

    const rateLimitResponse = await enforceVapiCallRateLimit(auth.effectiveUserId);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = (await request.json()) as InitiateVapiCallPayload;

    if (!body.ledger_id?.trim()) {
      return NextResponse.json({ error: "ledger_id is required." }, { status: 400 });
    }

    supabase = createAdminSupabaseClient();

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, phone_number")
      .eq("id", effectiveUserId)
      .single();

    if (userError || !userRow) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const ledger = await fetchLedgerById(
      supabase,
      effectiveUserId,
      body.ledger_id.trim()
    );

    if (!ledger) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    if (!canInitiateAiCallForLedger(ledger)) {
      return NextResponse.json(
        {
          error: ledger.business_id
            ? "AI calls can only be initiated for overdue business ledgers with an outstanding balance."
            : "AI voice calls are not available for personal ledgers.",
        },
        { status: 400 }
      );
    }

    let business: Pick<Business, "business_name"> | null = null;

    if (ledger.business_id) {
      const { data: businessData, error: businessError } = await supabase
        .from("businesses")
        .select("business_name")
        .eq("id", ledger.business_id)
        .eq("user_id", effectiveUserId)
        .maybeSingle();

      if (businessError) {
        return NextResponse.json(
          { error: businessError.message || "Failed to load business profile." },
          { status: 500 }
        );
      }

      business = businessData as Pick<Business, "business_name"> | null;
    }

    let walletBalance: number | null = null;

    if (!isDevelopment) {
      const reservedBalance = await reserveVapiCredits(
        supabase,
        effectiveUserId,
        VAPI_CALL_CREDIT_COST
      );

      if (reservedBalance === null) {
        return NextResponse.json(
          {
            error: `Insufficient AI credits. You need at least ${VAPI_CALL_CREDIT_COST} credits to initiate a call.`,
            required_credits: VAPI_CALL_CREDIT_COST,
          },
          { status: 402 }
        );
      }

      reservedCredits = true;
      walletBalance = reservedBalance;
    }

    const draft = draftVapiCall({
      ledger,
      business,
      userId: effectiveUserId,
      ownerPhoneNumber: userRow.phone_number ?? null,
    });

    let callResult;

    try {
      callResult = await initiateVapiOutboundCall(draft);
    } catch (callError) {
      if (reservedCredits && supabase && effectiveUserId) {
        await refundVapiCredits(
          supabase,
          effectiveUserId,
          VAPI_CALL_CREDIT_COST
        );
        reservedCredits = false;
      }

      throw callError;
    }

    const { data: communicationLog, error: logError } = await supabase
      .from("communication_logs")
      .insert({
        ledger_id: ledger.id,
        type: "vapi_call",
        status: "sent",
        cost_deducted: isDevelopment ? 0 : VAPI_CALL_CREDIT_COST,
        vapi_call_id: callResult.vapi_call_id ?? null,
        executed_at: new Date().toISOString(),
      })
      .select(
        "id, ledger_id, type, status, cost_deducted, executed_at, vapi_call_id, recording_url, sentiment, executive_summary, duration_seconds"
      )
      .single();

    if (logError || !communicationLog) {
      if (reservedCredits && effectiveUserId) {
        await refundVapiCredits(
          supabase,
          effectiveUserId,
          VAPI_CALL_CREDIT_COST
        );
        reservedCredits = false;
      }

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
      vapi_wallet_balance: walletBalance,
      draft: {
        customer_number: draft.customer_number,
        context: draft.context,
        system_prompt: draft.system_prompt,
        first_message: draft.first_message,
      },
    });
  } catch (error) {
    if (
      reservedCredits &&
      supabase &&
      effectiveUserId &&
      !isDevelopment
    ) {
      try {
        await refundVapiCredits(
          supabase,
          effectiveUserId,
          VAPI_CALL_CREDIT_COST
        );
      } catch (refundError) {
        console.error("[Recoverpe VAPI] Failed to refund reserved credits:", refundError);
      }
    }

    if (error instanceof TraiCurfewError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const message =
      error instanceof Error ? error.message : "Failed to initiate AI voice call.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { permission: "spend_funds" });
