import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { resolveWorkspaceAuth } from "@/lib/auth-gateway";
import {
  WORKSPACE_ROLE_TAG,
  workspaceRoleUserTag,
} from "@/lib/dashboard-cache";
import { resolveWorkspaceRoleForUser } from "@/lib/workspace-rbac";

export async function GET(request: Request) {
  try {
    const authResult = await resolveWorkspaceAuth(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const getCachedRoleContext = unstable_cache(
      async () =>
        resolveWorkspaceRoleForUser(
          authResult.actorUserId,
          authResult.workspaceUserId
        ),
      [
        "workspace-role",
        authResult.actorUserId,
        authResult.workspaceUserId,
      ],
      {
        tags: [
          WORKSPACE_ROLE_TAG,
          workspaceRoleUserTag(
            authResult.actorUserId,
            authResult.workspaceUserId
          ),
        ],
        revalidate: 60,
      }
    );

    const roleContext = await getCachedRoleContext();

    return NextResponse.json(roleContext);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve workspace role.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
