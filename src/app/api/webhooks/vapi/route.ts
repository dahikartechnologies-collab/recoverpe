import { NextResponse } from "next/server";
import {
  buildVapiInsightsFromReport,
  parseVapiEndOfCallReport,
  verifyVapiWebhookSecret,
} from "@/lib/vapi-webhook";
import {
  fetchBusinessUsageMeteringRow,
  incrementVapiMinutesUsageSafely,
} from "@/lib/business-usage-metering";
import {
  calculateVapiCallBill,
  getPremiumTrialMinutesRemaining,
  splitVapiBillAcrossTrialAndWallet,
} from "@/lib/vapi-pricing";
import { reserveVapiCredits } from "@/lib/vapi-wallet";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const verification = verifyVapiWebhookSecret(request);

    if (!verification.ok) {
      if (verification.missingEnv) {
        console.error(
          `[Recoverpe VAPI Webhook] Configure ${verification.missingEnv} in Vercel.`
        );
      }

      return NextResponse.json(
        { error: verification.reason },
        { status: verification.missingEnv ? 503 : 401 }
      );
    }

    const payload = await request.json();
    const report = parseVapiEndOfCallReport(payload);

    if (!report) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const bill = calculateVapiCallBill(report.duration_seconds);
    const insights = buildVapiInsightsFromReport(report);
    const supabase = createAdminSupabaseClient();

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
      .select("id, user_id, business_id, contact_id")
      .eq("id", ledgerId)
      .maybeSingle();

    if (ledgerError || !ledgerRow) {
      return NextResponse.json({ error: "Ledger not found for VAPI call." }, { status: 404 });
    }

    const userId = report.user_id ?? ledgerRow.user_id;
    const businessId = (ledgerRow.business_id as string | null) ?? null;
    const contactId = (ledgerRow.contact_id as string | null) ?? null;
    const callSummary =
      report.summary?.trim() ||
      insights.executive_summary?.trim() ||
      "AI voice recovery call completed.";

    const alreadyReconciled =
      Boolean(existingLog) && existingLog!.status === "call_completed";

    let walletChargeInr = 0;
    let trialMinutesApplied = 0;

    if (!alreadyReconciled && businessId) {
      const usageRow = await fetchBusinessUsageMeteringRow(supabase, businessId);
      const trialMinutesRemaining = getPremiumTrialMinutesRemaining({
        subscription_tier: usageRow?.subscription_tier,
        subscription_status: usageRow?.subscription_status,
        subscription_expires_at: usageRow?.subscription_expires_at,
        subscription_billing_tier: usageRow?.subscription_billing_tier,
        razorpay_subscription_id: usageRow?.razorpay_subscription_id,
        usage_vapi_minutes: usageRow?.usage_vapi_minutes ?? 0,
      });

      const split = splitVapiBillAcrossTrialAndWallet(
        bill,
        trialMinutesRemaining
      );
      trialMinutesApplied = split.trial_minutes_applied;
      walletChargeInr = split.wallet_charge_inr;

      if (trialMinutesApplied > 0) {
        await incrementVapiMinutesUsageSafely(
          supabase,
          businessId,
          trialMinutesApplied
        );
      }

      if (walletChargeInr > 0) {
        const newBalance = await reserveVapiCredits(
          supabase,
          userId as string,
          walletChargeInr
        );

        if (newBalance === null) {
          return NextResponse.json(
            {
              error:
                "Insufficient AI Voice Wallet balance to reconcile call usage.",
            },
            { status: 402 }
          );
        }
      }
    }

    const totalChargeInr = alreadyReconciled
      ? Number(existingLog?.cost_deducted ?? 0)
      : bill.customer_charge_inr;

    const logUpdate = {
      user_id: userId as string,
      business_id: businessId,
      contact_id: contactId,
      channel: "voice_ai" as const,
      direction: "outbound" as const,
      status: "call_completed" as const,
      cost_deducted: totalChargeInr,
      recording_url: report.recording_url,
      sentiment: insights.sentiment,
      executive_summary: insights.executive_summary,
      summary: callSummary,
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
      customer_charge_inr: totalChargeInr,
      provider_cost_inr: bill.provider_cost_inr,
      margin_inr: bill.margin_inr,
      trial_minutes_applied: trialMinutesApplied,
      wallet_charge_inr: walletChargeInr,
      sentiment: insights.sentiment_display,
      already_reconciled: alreadyReconciled,
    });

    return NextResponse.json({
      received: true,
      vapi_call_id: report.vapi_call_id,
      ledger_id: ledgerId,
      customer_charge_inr: totalChargeInr,
      wallet_charge_inr: walletChargeInr,
      trial_minutes_applied: trialMinutesApplied,
      provider_cost_inr: bill.provider_cost_inr,
      margin_inr: bill.margin_inr,
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
