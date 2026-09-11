import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { IMPERSONATE_USER_HEADER } from "@/lib/impersonate";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import {
  WORKSPACE_BUSINESS_COOKIE,
  WORKSPACE_USER_COOKIE,
  getCookieValue,
} from "@/lib/workspace-context";

export { IMPERSONATE_USER_HEADER } from "@/lib/impersonate";

export interface EffectiveUserContext {
  actorUserId: string;
  effectiveUserId: string;
  isGhostMode: boolean;
  impersonatedUserEmail: string | null;
  idToken: string;
}

export function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice(7);
}

const USER_LOOKUP_TTL_MS = 45_000;

type CachedAuthUser = {
  userId: string;
  accountStatus: string;
  expiresAt: number;
};

const authenticatedUserCache = new Map<string, CachedAuthUser>();

export async function getAuthenticatedUserId(idToken: string): Promise<string> {
  const decodedToken = await verifyFirebaseIdToken(idToken);
  const cached = authenticatedUserCache.get(decodedToken.uid);

  if (cached && cached.expiresAt > Date.now()) {
    if (cached.accountStatus === "suspended") {
      throw new Error("ACCOUNT_SUSPENDED");
    }

    if (cached.accountStatus === "pending_purge") {
      throw new Error("ACCOUNT_PENDING_PURGE");
    }

    return cached.userId;
  }

  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("users")
    .select("id, account_status")
    .eq("firebase_uid", decodedToken.uid)
    .single();

  if (error || !data) {
    throw new Error("User profile not found. Complete mobile verification first.");
  }

  const accountStatus = (data.account_status as string) ?? "active";
  authenticatedUserCache.set(decodedToken.uid, {
    userId: data.id as string,
    accountStatus,
    expiresAt: Date.now() + USER_LOOKUP_TTL_MS,
  });

  if (accountStatus === "suspended") {
    throw new Error("ACCOUNT_SUSPENDED");
  }

  if (accountStatus === "pending_purge") {
    throw new Error("ACCOUNT_PENDING_PURGE");
  }

  return data.id as string;
}

export async function requireAuthenticatedUser(request: Request) {
  const idToken = getBearerToken(request);

  if (!idToken) {
    return {
      error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  try {
    const userId = await getAuthenticatedUserId(idToken);

    return { userId, idToken };
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_SUSPENDED") {
      return {
        error: NextResponse.json(
          {
            error: "Account suspended by administrator",
            code: "ACCOUNT_SUSPENDED",
          },
          { status: 403 }
        ),
      };
    }

    if (error instanceof Error && error.message === "ACCOUNT_PENDING_PURGE") {
      return {
        error: NextResponse.json(
          {
            error: "Account scheduled for deletion per DPDP compliance.",
            code: "ACCOUNT_PENDING_PURGE",
          },
          { status: 403 }
        ),
      };
    }

    const message =
      error instanceof Error ? error.message : "Authentication failed.";

    return {
      error: NextResponse.json({ error: message }, { status: 401 }),
    };
  }
}

export async function requireSuperAdminUser(request: Request) {
  const authResult = await requireAuthenticatedUser(request);

  if ("error" in authResult) {
    return authResult;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, is_super_admin")
    .eq("id", authResult.userId)
    .single();

  if (error || !data) {
    return {
      error: NextResponse.json({ error: "User profile not found." }, { status: 404 }),
    };
  }

  if (!data.is_super_admin) {
    return {
      error: NextResponse.json({ error: "Forbidden." }, { status: 403 }),
    };
  }

  return { userId: authResult.userId, idToken: authResult.idToken };
}

async function resolveWorkspaceEffectiveUserId(
  actorUserId: string,
  requestedWorkspaceUserId: string | null
): Promise<string> {
  if (!requestedWorkspaceUserId || requestedWorkspaceUserId === actorUserId) {
    return actorUserId;
  }

  const supabase = createAdminSupabaseClient();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("member_user_id", actorUserId)
    .eq("workspace_user_id", requestedWorkspaceUserId)
    .eq("status", "accepted")
    .maybeSingle();

  if (membership) {
    return requestedWorkspaceUserId;
  }

  return actorUserId;
}

export async function resolveEffectiveUserContext(
  request: Request
): Promise<EffectiveUserContext | { error: NextResponse }> {
  const authResult = await requireAuthenticatedUser(request);

  if ("error" in authResult) {
    return authResult as { error: NextResponse };
  }

  const impersonateUserId =
    request.headers.get(IMPERSONATE_USER_HEADER)?.trim() ||
    new URL(request.url).searchParams.get("impersonate")?.trim() ||
    null;

  if (impersonateUserId) {
    const supabase = createAdminSupabaseClient();
    const { data: actor, error: actorError } = await supabase
      .from("users")
      .select("id, is_super_admin")
      .eq("id", authResult.userId)
      .single();

    if (actorError || !actor?.is_super_admin) {
      return {
        actorUserId: authResult.userId,
        effectiveUserId: authResult.userId,
        isGhostMode: false,
        impersonatedUserEmail: null,
        idToken: authResult.idToken,
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
        effectiveUserId: authResult.userId,
        isGhostMode: false,
        impersonatedUserEmail: null,
        idToken: authResult.idToken,
      };
    }

    return {
      actorUserId: authResult.userId,
      effectiveUserId: targetUser.id as string,
      isGhostMode: true,
      impersonatedUserEmail: targetUser.email as string,
      idToken: authResult.idToken,
    };
  }

  const cookieHeader = request.headers.get("cookie");
  const requestedWorkspaceUserId = getCookieValue(
    cookieHeader,
    WORKSPACE_USER_COOKIE
  );

  const effectiveUserId = await resolveWorkspaceEffectiveUserId(
    authResult.userId,
    requestedWorkspaceUserId
  );

  return {
    actorUserId: authResult.userId,
    effectiveUserId,
    isGhostMode: false,
    impersonatedUserEmail: null,
    idToken: authResult.idToken,
  };
}

export function getRequestedBusinessIdFromRequest(request: Request): string | null {
  return getCookieValue(request.headers.get("cookie"), WORKSPACE_BUSINESS_COOKIE);
}

export function assertActorOwnWorkspace(
  request: Request,
  actorUserId: string
): NextResponse | null {
  const workspaceUserId = getCookieValue(
    request.headers.get("cookie"),
    WORKSPACE_USER_COOKIE
  );

  if (workspaceUserId && workspaceUserId !== actorUserId) {
    return NextResponse.json(
      {
        error:
          "Forbidden. This action is only available in your own workspace context.",
      },
      { status: 403 }
    );
  }

  return null;
}

export function ghostModeWriteBlockedResponse(
  context: EffectiveUserContext
): NextResponse | null {
  if (context.isGhostMode) {
    return NextResponse.json(
      { error: "Write operations are disabled in Ghost Mode." },
      { status: 403 }
    );
  }

  return null;
}
