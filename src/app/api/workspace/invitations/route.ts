import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { listPendingInvitationsForUser } from "@/lib/workspace-invitations";

export async function GET(request: Request) {
  try {
    const authResult = await requireAuthenticatedUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const invitations = await listPendingInvitationsForUser(authResult.userId);

    return NextResponse.json({ invitations });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load invitations.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
