import { NextResponse } from "next/server";
import { resolveWorkspaceAuth } from "@/lib/auth-gateway";
import { fetchContactDirectory } from "@/lib/vendor-queries";
import { fetchAssignedContactIds, resolveDataAccessScope } from "@/lib/workspace-data-scope";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

function resolveBusinessScope(searchParams: URLSearchParams): {
  businessId: string | null;
  error?: NextResponse;
} {
  const workspaceMode = searchParams.get("workspace_mode")?.trim() ?? "business";
  const businessIdParam = searchParams.get("business_id")?.trim() ?? "";

  if (workspaceMode === "personal") {
    return { businessId: null };
  }

  if (!businessIdParam) {
    return {
      businessId: null,
      error: NextResponse.json(
        {
          error:
            "business_id is required when viewing the vendor directory in business mode.",
        },
        { status: 400 }
      ),
    };
  }

  return { businessId: businessIdParam };
}

export async function GET(request: Request) {
  try {
    const authResult = await resolveWorkspaceAuth(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const dataScope = resolveDataAccessScope(authResult);
    const { searchParams } = new URL(request.url);
    const scope = resolveBusinessScope(searchParams);

    if (scope.error) {
      return scope.error;
    }

    const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const limitParam = Number.parseInt(searchParams.get("limit") ?? "50", 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isFinite(limitParam) ? limitParam : 50;
    const offset = (page - 1) * limit;

    const supabase = createAdminSupabaseClient();

    if (scope.businessId) {
      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("id")
        .eq("id", scope.businessId)
        .eq("user_id", authResult.effectiveUserId)
        .maybeSingle();

      if (businessError) {
        return NextResponse.json(
          { error: businessError.message || "Failed to verify business scope." },
          { status: 500 }
        );
      }

      if (!business) {
        return NextResponse.json(
          { error: "Business not found for the active workspace." },
          { status: 404 }
        );
      }
    }

    const directory = await fetchContactDirectory(
      supabase,
      authResult.effectiveUserId,
      { limit, offset, businessId: scope.businessId }
    );

    if (dataScope.restrictToAssignedUserId) {
      const allowedContactIds = new Set(
        await fetchAssignedContactIds(
          supabase,
          authResult.effectiveUserId,
          dataScope.restrictToAssignedUserId,
          scope.businessId
        )
      );

      const scopedContacts = directory.contacts.filter((contact) =>
        allowedContactIds.has(contact.contact_id)
      );

      return NextResponse.json({
        contacts: scopedContacts,
        pagination: {
          ...directory.pagination,
          total: scopedContacts.length,
          hasMore: false,
        },
      });
    }

    return NextResponse.json(directory);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load vendor directory.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
