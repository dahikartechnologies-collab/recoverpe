import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/api-auth";
import { runDailyReminderJob } from "@/lib/cron/reminder-sender";
import { verifyCronSecret } from "@/lib/cron/daily-runner";
import { getTodayDateStringInIst } from "@/lib/timezone";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handleDailyEscalations(request: Request) {
  const startedAt = new Date().toISOString();
  const isCronAuthorized = verifyCronSecret(request);
  let isSuperAdminTrigger = false;

  if (!isCronAuthorized) {
    const adminResult = await requireSuperAdminUser(request);

    if ("error" in adminResult) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    isSuperAdminTrigger = true;
  }

  const { searchParams } = new URL(request.url);
  const referenceDate =
    searchParams.get("reference_date") ?? getTodayDateStringInIst();

  const supabase = createAdminSupabaseClient();
  const run = await runDailyReminderJob(supabase, referenceDate, {
    bypassCurfew: isSuperAdminTrigger,
  });

  const sentCount = run.results.filter((result) => result.status === "sent").length;
  const failedCount = run.results.filter((result) => result.status === "failed").length;
  const skippedCurfewCount = run.results.filter(
    (result) => result.status === "skipped_curfew"
  ).length;
  const escalationTargets = run.targets.filter((target) => target.days_from_due > 3);

  return NextResponse.json({
    success: true,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    reference_date: referenceDate,
    triggered_by: isSuperAdminTrigger ? "super_admin" : "cron_secret",
    bypass_curfew: isSuperAdminTrigger,
    target_count: run.targets.length,
    escalation_target_count: escalationTargets.length,
    sent_count: sentCount,
    failed_count: failedCount,
    skipped_curfew_count: skippedCurfewCount,
    targets: run.targets,
    results: run.results,
  });
}

export async function POST(request: Request) {
  try {
    return await handleDailyEscalations(request);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Daily escalation cron failed.";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    return await handleDailyEscalations(request);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Daily escalation cron failed.";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
