import { NextResponse } from "next/server";
import { loadDashboardSession } from "@/lib/dashboard-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const result = await loadDashboardSession(request);

    if ("error" in result) {
      return result.error;
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard session.";

    const status = message === "User profile not found." ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
