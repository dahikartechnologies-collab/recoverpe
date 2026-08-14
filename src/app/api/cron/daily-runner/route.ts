import { NextResponse } from "next/server";
import {
  fetchCronReminderTargets,
  verifyCronSecret,
} from "@/lib/cron/daily-runner";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const referenceDate =
      searchParams.get("reference_date") ??
      new Date().toISOString().slice(0, 10);

    const supabase = createAdminSupabaseClient();
    const targets = await fetchCronReminderTargets(supabase, referenceDate);

    console.log("[Recoverpe Daily Runner]", {
      reference_date: referenceDate,
      target_count: targets.length,
      targets,
    });

    return NextResponse.json({
      success: true,
      reference_date: referenceDate,
      target_count: targets.length,
      targets,
      note:
        "Development mode: targets logged only. WhatsApp send loop is not invoked.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Daily runner failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
