import { NextResponse } from "next/server";
import { requireDiagnosticsAccess } from "@/lib/diagnostics/access";
import { runIntegrationHealthChecks } from "@/lib/diagnostics/health-checks";

export async function GET(request: Request) {
  try {
    const access = await requireDiagnosticsAccess(request);

    if ("error" in access) {
      return access.error;
    }

    const health = await runIntegrationHealthChecks();

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to run integration health checks.";

    return NextResponse.json(
      {
        status: "degraded",
        services: {
          supabase: "failed",
          firebase: "failed",
          redis: "failed",
          razorpay: "failed",
          vapi: "failed",
        },
        service_errors: {
          supabase: message,
        },
        checked_at: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}
