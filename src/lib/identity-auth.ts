import { NextResponse } from "next/server";
import {
  getBearerToken,
  IMPERSONATE_USER_HEADER,
  requireAuthenticatedUser,
} from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export interface ActorIdentityContext {
  actorUserId: string;
  idToken: string;
  isGhostMode: boolean;
  impersonatedUserId: string | null;
  impersonatedUserEmail: string | null;
}

/**
 * Identity-only auth: never reads workspace cookies.
 * Used exclusively by /api/users/* identity routes.
 */
export async function requireActorIdentity(
  request: Request,
  options?: { allowGhostMode?: boolean }
): Promise<ActorIdentityContext | { error: NextResponse }> {
  const authResult = await requireAuthenticatedUser(request);

  if ("error" in authResult) {
    return { error: authResult.error! };
  }

  const allowGhostMode = options?.allowGhostMode ?? false;

  if (!allowGhostMode) {
    return {
      actorUserId: authResult.userId,
      idToken: authResult.idToken,
      isGhostMode: false,
      impersonatedUserId: null,
      impersonatedUserEmail: null,
    };
  }

  const impersonateUserId =
    request.headers.get(IMPERSONATE_USER_HEADER)?.trim() ||
    new URL(request.url).searchParams.get("impersonate")?.trim() ||
    null;

  if (!impersonateUserId) {
    return {
      actorUserId: authResult.userId,
      idToken: authResult.idToken,
      isGhostMode: false,
      impersonatedUserId: null,
      impersonatedUserEmail: null,
    };
  }

  const supabase = createAdminSupabaseClient();
  const { data: actor, error: actorError } = await supabase
    .from("users")
    .select("id, is_super_admin")
    .eq("id", authResult.userId)
    .single();

  if (actorError || !actor?.is_super_admin) {
    return {
      actorUserId: authResult.userId,
      idToken: authResult.idToken,
      isGhostMode: false,
      impersonatedUserId: null,
      impersonatedUserEmail: null,
    };
  }

  const { data: targetUser, error: targetError } = await supabase
    .from("users")
    .select("id, email")
    .eq("id", impersonateUserId)
    .single();

  if (targetError || !targetUser) {
    return {
      actorUserId: authResult.userId,
      idToken: authResult.idToken,
      isGhostMode: false,
      impersonatedUserId: null,
      impersonatedUserEmail: null,
    };
  }

  return {
    actorUserId: authResult.userId,
    idToken: authResult.idToken,
    isGhostMode: true,
    impersonatedUserId: targetUser.id as string,
    impersonatedUserEmail: targetUser.email as string,
  };
}

export async function resolveIdentityProfileUserId(
  identity: ActorIdentityContext
): Promise<string> {
  if (identity.isGhostMode && identity.impersonatedUserId) {
    return identity.impersonatedUserId;
  }

  return identity.actorUserId;
}

export function identityWriteBlockedResponse(
  identity: ActorIdentityContext
): NextResponse | null {
  if (identity.isGhostMode) {
    return NextResponse.json(
      { error: "Write operations are disabled in Ghost Mode." },
      { status: 403 }
    );
  }

  return null;
}

export { getBearerToken };
