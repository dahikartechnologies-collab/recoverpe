import { NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";
import { IMPERSONATE_USER_HEADER } from "@/lib/impersonate";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

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

export async function getAuthenticatedUserId(idToken: string): Promise<string> {
  const decodedToken = await verifyFirebaseIdToken(idToken);
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("firebase_uid", decodedToken.uid)
    .single();

  if (error || !data) {
    throw new Error("User profile not found. Complete mobile verification first.");
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
    await verifyFirebaseIdToken(idToken);
    const userId = await getAuthenticatedUserId(idToken);

    return { userId, idToken };
  } catch (error) {
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

  if (!impersonateUserId) {
    return {
      actorUserId: authResult.userId,
      effectiveUserId: authResult.userId,
      isGhostMode: false,
      impersonatedUserEmail: null,
      idToken: authResult.idToken,
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
