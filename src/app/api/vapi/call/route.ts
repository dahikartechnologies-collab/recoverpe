import { NextResponse } from "next/server";
import { ghostModeWriteBlockedResponse, resolveEffectiveUserContext } from "@/lib/api-auth";
import { fetchLedgerById } from "@/lib/ledger-queries";
import { canInitiateAiCallForLedger } from "@/lib/ledger-status";
import {
  draftVapiCall,
  initiateVapiOutboundCall,
  VAPI_CALL_CREDIT_COST,
} from "@/lib/vapi";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { Business, CommunicationLog, InitiateVapiCallPayload } from "@/types";

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

    const body = (await request.json()) as InitiateVapiCallPayload;

    if (!body.ledger_id?.trim()) {
      return NextResponse.json({ error: "ledger_id is required." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const isDevelopment = process.env.NEXT_PUBLIC_APP_ENV === "development";

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, vapi_wallet_balance")
      .eq("id", contextResult.effectiveUserId)
      .single();

    if (userError || !userRow) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const walletBalance = Number(userRow.vapi_wallet_balance);

    if (!isDevelopment && walletBalance < VAPI_CALL_CREDIT_COST) {
      return NextResponse.json(
        {
          error: `Insufficient AI credits. You need at least ${VAPI_CALL_CREDIT_COST} credits to initiate a call.`,
          vapi_wallet_balance: walletBalance,
          required_credits: VAPI_CALL_CREDIT_COST,
        },
        { status: 402 }
      );
    }

    const ledger = await fetchLedgerById(
      supabase,
      contextResult.effectiveUserId,
      body.ledger_id.trim()
    );

    if (!ledger) {
      return NextResponse.json({ error: "Ledger not found." }, { status: 404 });
    }

    if (!canInitiateAiCallForLedger(ledger)) {
      return NextResponse.json(
        { error: "AI calls can only be initiated for overdue ledgers with an outstanding balance." },
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

    const draft = draftVapiCall({
      ledger,
      business,
      userId: contextResult.effectiveUserId,
    });

    let updatedWalletBalance = walletBalance;
    const costDeducted = isDevelopment ? 0 : VAPI_CALL_CREDIT_COST;

    if (!isDevelopment) {
      const { data: deductedUser, error: deductError } = await supabase
        .from("users")
        .update({
          vapi_wallet_balance: walletBalance - VAPI_CALL_CREDIT_COST,
        })
        .eq("id", contextResult.effectiveUserId)
        .gte("vapi_wallet_balance", VAPI_CALL_CREDIT_COST)
        .select("vapi_wallet_balance")
        .single();

      if (deductError || !deductedUser) {
        return NextResponse.json(
          {
            error: `Insufficient AI credits. You need at least ${VAPI_CALL_CREDIT_COST} credits to initiate a call.`,
            vapi_wallet_balance: walletBalance,
            required_credits: VAPI_CALL_CREDIT_COST,
          },
          { status: 402 }
        );
      }

      updatedWalletBalance = Number(deductedUser.vapi_wallet_balance);
    }

    let callResult;

    try {
      callResult = await initiateVapiOutboundCall(draft);
    } catch (callError) {
      if (!isDevelopment) {
        await supabase
          .from("users")
          .update({ vapi_wallet_balance: walletBalance })
          .eq("id", contextResult.effectiveUserId);
      }

      throw callError;
    }

    const { data: communicationLog, error: logError } = await supabase
      .from("communication_logs")
      .insert({
        ledger_id: ledger.id,
        type: "vapi_call",
        status: "sent",
        cost_deducted: costDeducted,
        executed_at: new Date().toISOString(),
      })
      .select("id, ledger_id, type, status, cost_deducted, executed_at")
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
      vapi_wallet_balance: updatedWalletBalance,
      draft: {
        customer_number: draft.customer_number,
        context: draft.context,
        system_prompt: draft.system_prompt,
        first_message: draft.first_message,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to initiate AI voice call.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
