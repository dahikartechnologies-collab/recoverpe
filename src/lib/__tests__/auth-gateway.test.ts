import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import {
  withWorkspaceMutation,
  WorkspaceMutationContext,
} from "@/lib/auth-gateway";
import {
  WORKSPACE_BUSINESS_COOKIE,
  WORKSPACE_USER_COOKIE,
} from "@/lib/cookie-constants";
import { IMPERSONATE_USER_HEADER } from "@/lib/impersonate";
import { FakeDb } from "@/lib/payments/__tests__/fake-supabase";
import { CustomPermissions } from "@/types";

const OWNER_ID = "owner-1";
const MEMBER_ID = "member-1";
const OTHER_OWNER_ID = "owner-2";

const state = vi.hoisted(() => ({
  authenticatedUserId: null as string | null,
  db: {} as Record<string, Record<string, unknown>[]>,
}));

vi.mock("@/lib/api-auth", async () => {
  const { getCookieValue, WORKSPACE_BUSINESS_COOKIE: businessCookie } =
    await import("@/lib/workspace-context");
  const { IMPERSONATE_USER_HEADER: header } = await import("@/lib/impersonate");
  const { NextResponse: Res } = await import("next/server");

  return {
    IMPERSONATE_USER_HEADER: header,
    requireAuthenticatedUser: async () =>
      state.authenticatedUserId
        ? { userId: state.authenticatedUserId, idToken: "test-token" }
        : { error: Res.json({ error: "Unauthorized." }, { status: 401 }) },
    getRequestedBusinessIdFromRequest: (request: Request) =>
      getCookieValue(request.headers.get("cookie"), businessCookie),
  };
});

vi.mock("@/lib/supabase-admin", async () => {
  const { createFakeSupabase } = await import(
    "@/lib/payments/__tests__/fake-supabase"
  );

  return {
    createAdminSupabaseClient: () => createFakeSupabase(state.db).client,
  };
});

type RouteContext = { params?: Record<string, string> };
type RouteHandler = (
  request: Request,
  auth: WorkspaceMutationContext,
  context: RouteContext
) => Promise<NextResponse>;

function createHandler(): Mock<RouteHandler> {
  return vi.fn<RouteHandler>(async () => NextResponse.json({ ok: true }));
}

function authArgOf(handler: Mock<RouteHandler>): WorkspaceMutationContext {
  const call = handler.mock.calls[0];

  if (!call) {
    throw new Error("Expected the route handler to have been called.");
  }

  return call[1];
}

function permissions(
  overrides: Partial<CustomPermissions> = {}
): CustomPermissions {
  return {
    manage_team: false,
    edit_settings: false,
    edit_ledgers: false,
    send_reminders: false,
    export_data: false,
    spend_funds: false,
    ...overrides,
  };
}

function seed(memberPermissions: CustomPermissions = permissions()): FakeDb {
  return {
    workspace_members: [
      {
        id: "wm-1",
        member_user_id: MEMBER_ID,
        workspace_user_id: OWNER_ID,
        role: "accountant",
        status: "accepted",
        custom_permissions: memberPermissions,
      },
    ],
    businesses: [
      { id: "biz-owner", user_id: OWNER_ID },
      { id: "biz-outsider", user_id: OTHER_OWNER_ID },
    ],
  };
}

function buildRequest(
  options: {
    workspaceUserId?: string;
    businessId?: string;
    impersonate?: boolean;
  } = {}
): Request {
  const cookies: string[] = [];

  if (options.workspaceUserId) {
    cookies.push(`${WORKSPACE_USER_COOKIE}=${options.workspaceUserId}`);
  }

  if (options.businessId) {
    cookies.push(`${WORKSPACE_BUSINESS_COOKIE}=${options.businessId}`);
  }

  const headers = new Headers();

  if (cookies.length > 0) {
    headers.set("cookie", cookies.join("; "));
  }

  if (options.impersonate) {
    headers.set(IMPERSONATE_USER_HEADER, "some-user");
  }

  return new Request("https://recoverpe.test/api/ledgers", {
    method: "POST",
    headers,
  });
}

async function readCode(response: NextResponse): Promise<string | undefined> {
  const body = (await response.json()) as { code?: string };
  return body.code;
}

beforeEach(() => {
  state.authenticatedUserId = OWNER_ID;
  state.db = seed();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("withWorkspaceMutation", () => {
  it("refuses to run a handler that declares no authorization policy", async () => {
    // A route author forgetting the gate is the exact failure this exists for.
    const handler = createHandler();
    const route = withWorkspaceMutation(handler, {});

    const response = await route(buildRequest(), {});

    expect(response.status).toBe(403);
    expect(await readCode(response)).toBe("MUTATION_GATE_MISSING");
    expect(handler).not.toHaveBeenCalled();
  });

  it("refuses an unknown permission key", async () => {
    const handler = createHandler();
    const route = withWorkspaceMutation(handler, {
      permission: "delete_everything" as never,
    });

    const response = await route(buildRequest(), {});

    expect(response.status).toBe(403);
    expect(await readCode(response)).toBe("MUTATION_GATE_INVALID");
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects a member who lacks the required capability", async () => {
    state.authenticatedUserId = MEMBER_ID;
    state.db = seed(permissions({ export_data: true }));

    const handler = createHandler();
    const route = withWorkspaceMutation(handler, { permission: "edit_ledgers" });

    const response = await route(
      buildRequest({ workspaceUserId: OWNER_ID }),
      {}
    );

    expect(response.status).toBe(403);
    expect(await readCode(response)).toBe("PERMISSION_DENIED");
    expect(handler).not.toHaveBeenCalled();
  });

  it("admits a member holding the required capability", async () => {
    state.authenticatedUserId = MEMBER_ID;
    state.db = seed(permissions({ edit_ledgers: true }));

    const handler = createHandler();
    const route = withWorkspaceMutation(handler, { permission: "edit_ledgers" });

    const response = await route(
      buildRequest({ workspaceUserId: OWNER_ID }),
      {}
    );

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
    expect(authArgOf(handler).grantedBy).toBe("edit_ledgers");
    // Data scoping must follow the workspace, not the acting member.
    expect(authArgOf(handler).effectiveUserId).toBe(OWNER_ID);
  });

  it("admits the owner without consulting custom permissions", async () => {
    const handler = createHandler();
    const route = withWorkspaceMutation(handler, { permission: "manage_team" });

    const response = await route(buildRequest(), {});

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("rejects a delegated member on an owner-only route even with full permissions", async () => {
    state.authenticatedUserId = MEMBER_ID;
    state.db = seed(
      permissions({
        manage_team: true,
        edit_settings: true,
        edit_ledgers: true,
        send_reminders: true,
        export_data: true,
        spend_funds: true,
      })
    );

    const handler = createHandler();
    const route = withWorkspaceMutation(handler, { ownerOnly: true });

    const response = await route(
      buildRequest({ workspaceUserId: OWNER_ID }),
      {}
    );

    expect(response.status).toBe(403);
    expect(await readCode(response)).toBe("OWNER_ONLY");
    expect(handler).not.toHaveBeenCalled();
  });

  it("blocks writes from an impersonated Ghost Mode session", async () => {
    const handler = createHandler();
    const route = withWorkspaceMutation(handler, { permission: "edit_ledgers" });

    const response = await route(buildRequest({ impersonate: true }), {});

    expect(response.status).toBe(403);
    expect(await readCode(response)).toBe("GHOST_MODE_READ_ONLY");
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects an actor who is not a member of the requested workspace", async () => {
    state.authenticatedUserId = MEMBER_ID;

    const handler = createHandler();
    const route = withWorkspaceMutation(handler, { permission: "edit_ledgers" });

    const response = await route(
      buildRequest({ workspaceUserId: OTHER_OWNER_ID }),
      {}
    );

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects a route business id belonging to another tenant", async () => {
    const handler = createHandler();
    const route = withWorkspaceMutation(handler, {
      permission: "edit_settings",
      businessIdParam: "id",
    });

    const response = await route(buildRequest(), {
      params: { id: "biz-outsider" },
    });

    expect(response.status).toBe(403);
    expect(await readCode(response)).toBe("BUSINESS_TENANT_MISMATCH");
    expect(handler).not.toHaveBeenCalled();
  });

  it("accepts a route business id owned by the workspace", async () => {
    const handler = createHandler();
    const route = withWorkspaceMutation(handler, {
      permission: "edit_settings",
      businessIdParam: "id",
    });

    const response = await route(buildRequest(), {
      params: { id: "biz-owner" },
    });

    expect(response.status).toBe(200);
    expect(authArgOf(handler).businessId).toBe("biz-owner");
  });

  it("drops a stale cross-tenant business cookie instead of failing the request", async () => {
    const handler = createHandler();
    const route = withWorkspaceMutation(handler, { permission: "edit_ledgers" });

    const response = await route(
      buildRequest({ businessId: "biz-outsider" }),
      {}
    );

    // A stale cookie after a workspace switch must not 403 the user, but it
    // must never be treated as valid tenant context either.
    expect(response.status).toBe(200);
    expect(authArgOf(handler).businessId).toBeNull();
  });

  it("returns 401 for an unauthenticated request", async () => {
    state.authenticatedUserId = null;

    const handler = createHandler();
    const route = withWorkspaceMutation(handler, { permission: "edit_ledgers" });

    const response = await route(buildRequest(), {});

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});
