import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/api-auth";
import { fetchAllAdminBusinesses } from "@/lib/admin-businesses";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authResult = await requireSuperAdminUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const businesses = await fetchAllAdminBusinesses();

    return NextResponse.json({ businesses });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load admin businesses.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
