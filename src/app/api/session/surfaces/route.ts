import { NextResponse } from "next/server";
import { getActiveContextFromCookieHeader } from "@/lib/active-context";
import { requireActorIdentity } from "@/lib/identity-auth";
import { loadIdentitySurfaces } from "@/lib/identity-surfaces";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await requireActorIdentity(request);

  if ("error" in identity) {
    return identity.error;
  }

  const supabase = createAdminSupabaseClient();
  const surfaces = await loadIdentitySurfaces(supabase, identity.actorUserId);
  const activeContext = getActiveContextFromCookieHeader(
    request.headers.get("cookie")
  );

  return NextResponse.json({
    surfaces,
    active_context: activeContext,
  });
}
