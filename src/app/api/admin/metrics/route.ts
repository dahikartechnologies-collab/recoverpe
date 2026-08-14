import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/api-auth";
import { fetchAdminPlatformMetrics } from "@/lib/admin-metrics";

export async function GET(request: Request) {
  try {
    const authResult = await requireSuperAdminUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const data = await fetchAdminPlatformMetrics();

    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load admin metrics.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
