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

    return NextResponse.json(health, {
      status: health.status === "ok" ? 200 : 503,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to run integration health checks.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
