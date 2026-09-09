import { NextResponse } from "next/server";
import { assertActorOwnWorkspace, requireAuthenticatedUser } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase-authenticated";

interface BusinessOwnerMutationContext {
  actorUserId: string;
  idToken: string;
  userSupabase: ReturnType<typeof createAuthenticatedSupabaseClient>;
  business: {
    id: string;
    user_id: string;
  };
}

export async function requireBusinessOwnerMutationContext(
  request: Request,
  businessId: string
): Promise<BusinessOwnerMutationContext | { error: NextResponse }> {
  const authResult = await requireAuthenticatedUser(request);

  if ("error" in authResult) {
    return { error: authResult.error! };
  }

  const adminSupabase = createAdminSupabaseClient();
  const { data: business, error: lookupError } = await adminSupabase
    .from("businesses")
    .select("id, user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (lookupError || !business) {
    return {
      error: NextResponse.json({ error: "Business not found." }, { status: 404 }),
    };
  }

  const actorUserId = authResult.userId;

  const partnerBlocked = assertActorOwnWorkspace(request, actorUserId);

  if (partnerBlocked) {
    return { error: partnerBlocked };
  }

  if (business.user_id !== actorUserId) {
    return {
      error: NextResponse.json(
        {
          error:
            "Forbidden. Only the business owner can modify or delete this business.",
        },
        { status: 403 }
      ),
    };
  }

  const userSupabase = createAuthenticatedSupabaseClient(authResult.idToken);
  await userSupabase.auth.getUser(authResult.idToken);

  return {
    actorUserId,
    idToken: authResult.idToken,
    userSupabase,
    business: {
      id: business.id as string,
      user_id: business.user_id as string,
    },
  };
}
