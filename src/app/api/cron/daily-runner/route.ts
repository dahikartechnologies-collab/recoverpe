import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/daily-runner";
import { runAutopilotCadenceJob } from "@/lib/cron/autopilot-runner";
import {
  runDpdpAutoPurgeForCandidates,
} from "@/lib/cron/dpdp-purge";
import { fetchDpdpPurgeCandidates } from "@/lib/dpdp-erasure";
import { getTodayDateStringInIst } from "@/lib/timezone";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export const maxDuration = 60;

interface CronRunLogEntry {
  phase: string;
  status: "ok" | "error";
  message?: string;
  at: string;
}

function logPhase(
  runLog: CronRunLogEntry[],
  phase: string,
  status: "ok" | "error",
  message?: string
): void {
  runLog.push({
    phase,
    status,
    message,
    at: new Date().toISOString(),
  });
}

export async function GET(request: Request) {
  const startedAt = new Date().toISOString();
  const runLog: CronRunLogEntry[] = [];

  try {
    if (!verifyCronSecret(request)) {
      logPhase(runLog, "auth", "error", "Invalid or missing CRON_SECRET.");
      return NextResponse.json({ error: "Unauthorized.", run_log: runLog }, { status: 401 });
    }

    logPhase(runLog, "auth", "ok");

    const { searchParams } = new URL(request.url);
    const referenceDate =
      searchParams.get("reference_date") ?? getTodayDateStringInIst();

    const supabase = createAdminSupabaseClient();

    let purgeResults: Awaited<ReturnType<typeof runDpdpAutoPurgeForCandidates>>["purged"] =
      [];
    let purgeFailures: Awaited<
      ReturnType<typeof runDpdpAutoPurgeForCandidates>
    >["failures"] = [];

    try {
      const candidates = await fetchDpdpPurgeCandidates(supabase);
      const purgeRun = await runDpdpAutoPurgeForCandidates(supabase, candidates);
      purgeResults = purgeRun.purged;
      purgeFailures = purgeRun.failures;

      logPhase(
        runLog,
        "dpdp_purge",
        purgeFailures.length > 0 ? "error" : "ok",
        `Purged ${purgeResults.length} scheduled account(s)${
          purgeFailures.length > 0 ? `; ${purgeFailures.length} failed.` : "."
        }`
      );
    } catch (purgeError) {
      const message =
        purgeError instanceof Error
          ? purgeError.message
          : "DPDP auto-purge failed.";

      logPhase(runLog, "dpdp_purge", "error", message);
      throw purgeError;
    }

    let autopilotRun: Awaited<ReturnType<typeof runAutopilotCadenceJob>> = {
      enrolled_count: 0,
      processed_count: 0,
      results: [],
    };

    try {
      autopilotRun = await runAutopilotCadenceJob(supabase, {
        batchSize: 40,
        timeBudgetMs: 50_000,
      });

      logPhase(
        runLog,
        "autopilot_dispatch",
        "ok",
        `Enrolled ${autopilotRun.enrolled_count}; processed ${autopilotRun.processed_count} cadence run(s).`
      );
    } catch (autopilotError) {
      const message =
        autopilotError instanceof Error
          ? autopilotError.message
          : "Autopilot cadence job failed.";

      logPhase(runLog, "autopilot_dispatch", "error", message);
      throw autopilotError;
    }

    const sentCount = autopilotRun.results.filter(
      (result) => result.reminder_sent
    ).length;
    const monetizationCount = autopilotRun.results.filter(
      (result) => result.monetization_flagged
    ).length;
    const skippedIdempotentCount = autopilotRun.results.filter(
      (result) => result.status === "skipped_idempotent"
    ).length;
    const skippedCurfewCount = autopilotRun.results.filter(
      (result) => result.status === "skipped_curfew"
    ).length;
    const haltedCount = autopilotRun.results.filter(
      (result) => result.status === "halted"
    ).length;
    const failedCount = autopilotRun.results.filter(
      (result) => result.status === "failed"
    ).length;
    const autopilotErrors = autopilotRun.results
      .filter((result) => result.status === "failed")
      .map((result) => ({
        ledger_id: result.ledger_id,
        step_index: result.step_index,
        message: result.message ?? "Autopilot run failed.",
      }));

    if (autopilotErrors.length > 0) {
      logPhase(
        runLog,
        "autopilot_errors",
        "error",
        `${autopilotErrors.length} autopilot run(s) failed.`
      );
    } else {
      logPhase(runLog, "autopilot_errors", "ok", "No autopilot failures.");
    }

    console.log("[Recoverpe Daily Runner]", {
      started_at: startedAt,
      reference_date: referenceDate,
      dpdp_purged_count: purgeResults.length,
      enrolled_count: autopilotRun.enrolled_count,
      processed_count: autopilotRun.processed_count,
      sent_count: sentCount,
      monetization_count: monetizationCount,
      skipped_idempotent_count: skippedIdempotentCount,
      skipped_curfew_count: skippedCurfewCount,
      halted_count: haltedCount,
      failed_count: failedCount,
      trai_curfew_active: skippedCurfewCount > 0,
      run_log: runLog,
      autopilot_errors: autopilotErrors,
    });

    return NextResponse.json({
      success: true,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      reference_date: referenceDate,
      dpdp_purged_count: purgeResults.length,
      dpdp_purged_users: purgeResults,
      dpdp_purge_failures: purgeFailures,
      enrolled_count: autopilotRun.enrolled_count,
      processed_count: autopilotRun.processed_count,
      sent_count: sentCount,
      monetization_count: monetizationCount,
      skipped_idempotent_count: skippedIdempotentCount,
      skipped_curfew_count: skippedCurfewCount,
      halted_count: haltedCount,
      failed_count: failedCount,
      autopilot_errors: autopilotErrors,
      run_log: runLog,
      results: autopilotRun.results,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Daily runner failed.";

    logPhase(runLog, "runner", "error", message);

    console.error("[Recoverpe Daily Runner] Fatal error:", {
      started_at: startedAt,
      message,
      run_log: runLog,
    });

    return NextResponse.json(
      {
        success: false,
        error: message,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        run_log: runLog,
      },
      { status: 500 }
    );
  }
}
