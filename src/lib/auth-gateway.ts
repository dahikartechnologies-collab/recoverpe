import { NextResponse } from "next/server";
import {
  getRequestedBusinessIdFromRequest,
  IMPERSONATE_USER_HEADER,
  requireAuthenticatedUser,
} from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { parseCustomPermissions } from "@/lib/workspace-permissions";
import { getCookieValue, WORKSPACE_USER_COOKIE } from "@/lib/workspace-context";
import {
  AppRole,
  CustomPermissionKey,
  CustomPermissions,
  isCustomPermissionKey,
  OWNER_CUSTOM_PERMISSIONS,
} from "@/types";

export interface WorkspaceAuthContext {
  actorUserId: string;
  workspaceUserId: string;
  workspaceBusinessId: string | null;
  effectiveUserId: string;
  idToken: string;
  isOwner: boolean;
  role: AppRole;
  customPermissions: CustomPermissions;
}

export interface WorkspaceAuthOptions {
  requiredPermission?: keyof CustomPermissions;
  ownerOnly?: boolean;
}

async function verifyBusinessOwner(
  businessId: string,
  actorUserId: string
): Promise<NextResponse | null> {
  const supabase = createAdminSupabaseClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !business) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  if (business.user_id !== actorUserId) {
    return NextResponse.json(
      { error: "Forbidden. Only the business owner can perform this action." },
      { status: 403 }
    );
  }

  return null;
}

export async function resolveWorkspaceAuth(
  request: Request,
  options: WorkspaceAuthOptions & { businessId?: string | null } = {}
): Promise<WorkspaceAuthContext | { error: NextResponse }> {
  const authResult = await requireAuthenticatedUser(request);

  if ("error" in authResult) {
    return { error: authResult.error! };
  }

  const actorUserId = authResult.userId;
  const cookieHeader = request.headers.get("cookie");
  const workspaceUserId =
    getCookieValue(cookieHeader, WORKSPACE_USER_COOKIE) ?? actorUserId;
  const workspaceBusinessId =
    options.businessId ?? getRequestedBusinessIdFromRequest(request);

  const isOwner = actorUserId === workspaceUserId;
  const supabase = createAdminSupabaseClient();

  let role: AppRole = "owner";
  let customPermissions: CustomPermissions = { ...OWNER_CUSTOM_PERMISSIONS };

  if (!isOwner) {
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_members")
      .select("role, status, custom_permissions")
      .eq("member_user_id", actorUserId)
      .eq("workspace_user_id", workspaceUserId)
      .eq("status", "accepted")
      .maybeSingle();

    if (membershipError || !membership) {
      return {
        error: NextResponse.json(
          { error: "Forbidden. You do not have access to this workspace." },
          { status: 403 }
        ),
      };
    }

    role = membership.role as AppRole;
    customPermissions = parseCustomPermissions(membership.custom_permissions);
  }

  if (options.ownerOnly) {
    if (workspaceBusinessId) {
      const ownerError = await verifyBusinessOwner(workspaceBusinessId, actorUserId);

      if (ownerError) {
        return { error: ownerError };
      }
    } else if (!isOwner) {
      return {
        error: NextResponse.json(
          { error: "Forbidden. Owner access required." },
          { status: 403 }
        ),
      };
    }
  }

  if (options.requiredPermission && !isOwner) {
    if (!customPermissions[options.requiredPermission]) {
      return {
        error: NextResponse.json(
          {
            error: `Forbidden. Missing required permission: ${options.requiredPermission}.`,
          },
          { status: 403 }
        ),
      };
    }
  }

  return {
    actorUserId,
    workspaceUserId,
    workspaceBusinessId,
    effectiveUserId: workspaceUserId,
    idToken: authResult.idToken,
    isOwner,
    role,
    customPermissions,
  };
}

type WorkspaceRouteHandler<Context> = (
  request: Request,
  auth: WorkspaceAuthContext,
  context: Context
) => Promise<NextResponse>;

export function withWorkspaceAuth<Context extends { params?: Record<string, string> }>(
  handler: WorkspaceRouteHandler<Context>,
  options: WorkspaceAuthOptions = {}
) {
  return async (request: Request, context: Context): Promise<NextResponse> => {
    try {
      const businessId = context.params?.id ?? null;
      const authResult = await resolveWorkspaceAuth(request, {
        ...options,
        businessId,
      });

      if ("error" in authResult) {
        return authResult.error;
      }

      return await handler(request, authResult, context);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Request failed.";

      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

// ---------------------------------------------------------------------------
// Central mutation gate
// ---------------------------------------------------------------------------
//
// Every state-changing route handler must declare, at the wrapper, the single
// capability it needs. There is no implicit "any authenticated user may write"
// path: a route that forgets to declare a gate is rejected with 403 rather than
// silently running with owner privileges.
//
// Tenant context comes from the workspace cookie but is never trusted on its
// own. The cookie can only select a workspace the actor provably belongs to;
// membership is re-verified against workspace_members on every request, and a
// business id supplied by cookie is discarded unless it belongs to that same
// workspace.

export interface WorkspaceMutationOptions {
  /**
   * Capability the actor must hold in custom_permissions. Required unless
   * ownerOnly is set.
   */
  permission?: CustomPermissionKey;
  /**
   * Restrict to the workspace owner. Delegated members are rejected even if
   * they hold every capability.
   */
  ownerOnly?: boolean;
  /**
   * Name of the dynamic route segment carrying a business id, for
   * business-scoped routes. Omit for routes whose [id] is a ledger, contact or
   * member id — those must resolve and authorize their own subject.
   */
  businessIdParam?: string;
  /**
   * Permit a super admin in Ghost Mode to run this mutation. Off by default:
   * impersonated sessions are read-only.
   */
  allowGhostMode?: boolean;
}

export interface WorkspaceMutationContext extends WorkspaceAuthContext {
  /** Business id verified to belong to the resolved workspace, else null. */
  businessId: string | null;
  /** Which gate admitted this request, for audit logging. */
  grantedBy: "owner" | CustomPermissionKey;
}

interface RouteParamsContext {
  params?: Record<string, string> | Promise<Record<string, string>>;
}

function forbidden(error: string, code: string): NextResponse {
  return NextResponse.json({ error, code }, { status: 403 });
}

async function resolveRouteParams(
  context: RouteParamsContext
): Promise<Record<string, string>> {
  return (await context.params) ?? {};
}

async function fetchBusinessOwnerId(businessId: string): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("user_id")
    .eq("id", businessId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return (data.user_id as string) ?? null;
}

function isGhostModeRequest(request: Request): boolean {
  const header = request.headers.get(IMPERSONATE_USER_HEADER)?.trim();

  if (header) {
    return true;
  }

  try {
    return Boolean(new URL(request.url).searchParams.get("impersonate")?.trim());
  } catch {
    return false;
  }
}

/**
 * Validates the gate declaration itself. A misconfigured route is a server
 * bug, but it must still fail closed rather than fail open.
 */
function validateMutationOptions(
  options: WorkspaceMutationOptions
): NextResponse | null {
  const hasPermission = typeof options.permission === "string";

  if (!hasPermission && options.ownerOnly !== true) {
    console.error(
      "[auth-gateway] withWorkspaceMutation invoked without a permission or ownerOnly gate. Refusing the request."
    );

    return forbidden(
      "Forbidden. This action has no authorization policy configured.",
      "MUTATION_GATE_MISSING"
    );
  }

  if (hasPermission && !isCustomPermissionKey(options.permission as string)) {
    console.error(
      `[auth-gateway] withWorkspaceMutation received unknown permission key "${options.permission}". Refusing the request.`
    );

    return forbidden(
      "Forbidden. This action has an invalid authorization policy configured.",
      "MUTATION_GATE_INVALID"
    );
  }

  return null;
}

export function withWorkspaceMutation<Context extends RouteParamsContext>(
  handler: (
    request: Request,
    auth: WorkspaceMutationContext,
    context: Context
  ) => Promise<NextResponse>,
  options: WorkspaceMutationOptions
) {
  return async (request: Request, context: Context): Promise<NextResponse> => {
    try {
      const misconfigured = validateMutationOptions(options);

      if (misconfigured) {
        return misconfigured;
      }

      if (!options.allowGhostMode && isGhostModeRequest(request)) {
        return forbidden(
          "Write operations are disabled in Ghost Mode.",
          "GHOST_MODE_READ_ONLY"
        );
      }

      const params = await resolveRouteParams(context);
      const routeBusinessId = options.businessIdParam
        ? params[options.businessIdParam] ?? null
        : null;

      if (options.businessIdParam && !routeBusinessId) {
        return NextResponse.json(
          { error: "Business id is required for this action." },
          { status: 400 }
        );
      }

      // Resolve and verify tenant membership. Authorization is applied below so
      // that ownerOnly cannot be satisfied by a spoofed business cookie.
      const authResult = await resolveWorkspaceAuth(request, {
        businessId: routeBusinessId,
      });

      if ("error" in authResult) {
        return authResult.error;
      }

      const candidateBusinessId =
        routeBusinessId ?? getRequestedBusinessIdFromRequest(request);
      let businessId: string | null = null;

      if (candidateBusinessId) {
        const businessOwnerId = await fetchBusinessOwnerId(candidateBusinessId);

        if (businessOwnerId === authResult.workspaceUserId) {
          businessId = candidateBusinessId;
        } else if (routeBusinessId) {
          // An explicit path segment pointing outside the tenant is an attack
          // or a client bug, never a stale cookie. Refuse it.
          return businessOwnerId
            ? forbidden(
                "Forbidden. This business belongs to another workspace.",
                "BUSINESS_TENANT_MISMATCH"
              )
            : NextResponse.json(
                { error: "Business not found." },
                { status: 404 }
              );
        }
        // Otherwise the value came from a stale workspace cookie. Drop it
        // rather than failing the request.
      }

      if (options.ownerOnly) {
        if (!authResult.isOwner) {
          return forbidden(
            "Forbidden. Only the workspace owner can perform this action.",
            "OWNER_ONLY"
          );
        }

        if (businessId) {
          const businessOwnerId = await fetchBusinessOwnerId(businessId);

          if (businessOwnerId !== authResult.actorUserId) {
            return forbidden(
              "Forbidden. Only the business owner can perform this action.",
              "OWNER_ONLY"
            );
          }
        }
      }

      if (options.permission && !authResult.isOwner) {
        if (!authResult.customPermissions[options.permission]) {
          return forbidden(
            `Forbidden. Missing required permission: ${options.permission}.`,
            "PERMISSION_DENIED"
          );
        }
      }

      const mutationContext: WorkspaceMutationContext = {
        ...authResult,
        workspaceBusinessId: businessId,
        businessId,
        grantedBy: options.ownerOnly
          ? "owner"
          : (options.permission as CustomPermissionKey),
      };

      return await handler(request, mutationContext, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed.";

      console.error("[auth-gateway] Mutation handler failed:", message);

      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

/**
 * Secondary capability check for handlers that gate a sub-branch (for example,
 * a route that allows edits under edit_ledgers but writes off debt only for
 * owners).
 */
export function assertMutationCapability(
  auth: WorkspaceMutationContext,
  permission: CustomPermissionKey
): NextResponse | null {
  if (auth.isOwner || auth.customPermissions[permission]) {
    return null;
  }

  return forbidden(
    `Forbidden. Missing required permission: ${permission}.`,
    "PERMISSION_DENIED"
  );
}
