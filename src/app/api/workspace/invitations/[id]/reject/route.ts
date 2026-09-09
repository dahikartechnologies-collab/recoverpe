import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { respondToWorkspaceInvitation } from "@/lib/workspace-invitations";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const authResult = await requireAuthenticatedUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const { id } = await context.params;
    await respondToWorkspaceInvitation(authResult.userId, id, "rejected");

    return NextResponse.json({
      message: "Invitation declined.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reject invitation.";

    const status =
      message === "Invitation not found."
        ? 404
        : message === "You can only respond to invitations sent to you."
          ? 403
          : message === "This invitation has already been responded to."
            ? 409
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
