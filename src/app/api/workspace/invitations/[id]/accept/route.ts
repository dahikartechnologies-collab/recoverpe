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
    const result = await respondToWorkspaceInvitation(
      authResult.userId,
      id,
      "accepted"
    );

    return NextResponse.json({
      message: `You joined ${result.business_name}.`,
      workspace_user_id: result.workspace_user_id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to accept invitation.";

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
