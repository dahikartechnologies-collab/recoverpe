import { NextResponse } from "next/server";
import {
  buildVapiInsightsFromReport,
  parseVapiEndOfCallReport,
  verifyVapiWebhookSecret,
} from "@/lib/vapi-webhook";
import { VAPI_CALL_CREDIT_COST } from "@/lib/vapi";
import { reserveVapiCredits } from "@/lib/vapi-wallet";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!verifyVapiWebhookSecret(request)) {
      return NextResponse.json({ error: "Invalid webhook secret." }, { status: 401 });
    }

    const payload = await request.json();
    const report = parseVapiEndOfCallReport(payload);

    if (!report) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const insights = buildVapiInsightsFromReport(report);
    const supabase = createAdminSupabaseClient();
    const totalCreditCost = insights.credit_cost;

    const { data: existingLog, error: logLookupError } = await supabase
      .from("communication_logs")
      .select("id, ledger_id, cost_deducted, status, vapi_call_id")
      .eq("vapi_call_id", report.vapi_call_id)
      .maybeSingle();

    if (logLookupError) {
      return NextResponse.json(
        { error: logLookupError.message || "Failed to locate communication log." },
        { status: 500 }
      );
    }

    const ledgerId = report.ledger_id ?? existingLog?.ledger_id ?? null;

    if (!ledgerId) {
      return NextResponse.json(
        { error: "Unable to resolve ledger_id from VAPI webhook payload." },
        { status: 400 }
      );
    }

    const { data: ledgerRow, error: ledgerError } = await supabase
      .from("ledgers")
      .select("id, user_id")
      .eq("id", ledgerId)
      .maybeSingle();

    if (ledgerError || !ledgerRow) {
      return NextResponse.json({ error: "Ledger not found for VAPI call." }, { status: 404 });
    }

    const userId = report.user_id ?? ledgerRow.user_id;

    const reservedCredits = Number(existingLog?.cost_deducted ?? 0);
    const alreadyReconciled =
      Boolean(existingLog) &&
      existingLog!.status === "call_completed" &&
      reservedCredits >= totalCreditCost;

    let additionalCreditsCharged = 0;

    if (!alreadyReconciled) {
      const baselineReserved =
        reservedCredits > 0 ? reservedCredits : VAPI_CALL_CREDIT_COST;
      const additionalCost = Math.max(0, totalCreditCost - baselineReserved);

      if (additionalCost > 0) {
        const newBalance = await reserveVapiCredits(
          supabase,
          userId as string,
          additionalCost
        );

        if (newBalance === null) {
          return NextResponse.json(
            {
              error:
                "Insufficient AI credits to reconcile extended call duration.",
            },
            { status: 402 }
          );
        }

        additionalCreditsCharged = additionalCost;
      }
    }

    const logUpdate = {
      status: "call_completed" as const,
      cost_deducted: totalCreditCost,
      recording_url: report.recording_url,
      sentiment: insights.sentiment,
      executive_summary: insights.executive_summary,
      transcript: report.transcript || null,
      duration_seconds: report.duration_seconds,
      vapi_call_id: report.vapi_call_id,
      executed_at: new Date().toISOString(),
    };

    if (existingLog) {
      const { error: updateError } = await supabase
        .from("communication_logs")
        .update(logUpdate)
        .eq("id", existingLog.id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message || "Failed to update communication log." },
          { status: 500 }
        );
      }
    } else {
      const { error: insertError } = await supabase.from("communication_logs").insert({
        ledger_id: ledgerId,
        type: "vapi_call",
        ...logUpdate,
      });

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message || "Failed to create communication log." },
          { status: 500 }
        );
      }
    }

    console.log("[Recoverpe VAPI Webhook]", {
      vapi_call_id: report.vapi_call_id,
      ledger_id: ledgerId,
      duration_seconds: report.duration_seconds,
      total_credit_cost: totalCreditCost,
      reserved_credits: reservedCredits,
      additional_credits_charged: additionalCreditsCharged,
      sentiment: insights.sentiment_display,
      already_reconciled: alreadyReconciled,
    });

    return NextResponse.json({
      received: true,
      vapi_call_id: report.vapi_call_id,
      ledger_id: ledgerId,
      credit_cost: totalCreditCost,
      additional_credits_charged: additionalCreditsCharged,
      sentiment: insights.sentiment,
      executive_summary: insights.executive_summary,
      already_reconciled: alreadyReconciled,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "VAPI webhook processing failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
