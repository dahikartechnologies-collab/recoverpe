import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/api-auth";
import { buildGhostModeClearCookieHeader } from "@/lib/ghost-mode";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authResult = await requireSuperAdminUser(request);

  if ("error" in authResult) {
    return authResult.error;
  }

  return NextResponse.json(
    { success: true, message: "Ghost mode cleared." },
    {
      headers: {
        "Set-Cookie": buildGhostModeClearCookieHeader(),
      },
    }
  );
}
