import { NextResponse } from "next/server";
import {
  ActiveContext,
  contextCookieHeaderValue,
  isActiveContext,
} from "@/lib/active-context";
import { requireActorIdentity } from "@/lib/identity-auth";
import { loadIdentitySurfaces } from "@/lib/identity-surfaces";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const identity = await requireActorIdentity(request);

  if ("error" in identity) {
    return identity.error;
  }

  const body = (await request.json().catch(() => null)) as
    | { context?: string }
    | null;
  const context = body?.context;

  if (!isActiveContext(context)) {
    return NextResponse.json(
      { error: "Context must be merchant or agent." },
      { status: 400 }
    );
  }

  if (identity.isGhostMode && context === "agent") {
    return NextResponse.json(
      { error: "Ghost mode cannot switch into agent payouts." },
      { status: 403 }
    );
  }

  const supabase = createAdminSupabaseClient();
  const surfaces = await loadIdentitySurfaces(supabase, identity.actorUserId);

  if (context === "agent" && !surfaces.has_agent) {
    return NextResponse.json(
      { error: "This account has no RecoverPe agent profile." },
      { status: 403 }
    );
  }

  if (context === "merchant" && !surfaces.has_merchant) {
    return NextResponse.json(
      { error: "This account has no merchant workspace." },
      { status: 403 }
    );
  }

  const response = NextResponse.json({
    context: context as ActiveContext,
    surfaces,
  });
  response.headers.append("Set-Cookie", contextCookieHeaderValue(context));
  return response;
}
