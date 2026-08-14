import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/api-auth";
import { fetchAllAdminUsers } from "@/lib/admin-users";

export async function GET(request: Request) {
  try {
    const authResult = await requireSuperAdminUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const users = await fetchAllAdminUsers();

    return NextResponse.json({ users });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load admin users.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
