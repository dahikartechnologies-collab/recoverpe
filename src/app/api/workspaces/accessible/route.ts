import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { listAccessibleBusinesses } from "@/lib/accessible-workspaces";
import { AccessibleWorkspacesResponse } from "@/types";

export async function GET(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const options = await listAccessibleBusinesses(contextResult.actorUserId);
    const uniqueWorkspaceCount = options.length;

    const response: AccessibleWorkspacesResponse = {
      options,
      unique_workspace_count: uniqueWorkspaceCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load accessible workspaces.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
