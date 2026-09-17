import { NextRequest, NextResponse } from "next/server";
import {
  ACTOR_USER_COOKIE,
  APP_ROLE_COOKIE,
  AUTH_SESSION_COOKIE,
} from "@/lib/auth-cookies";
import {
  hasAuthSession,
  isAuthorizedAdmin,
  resolveAdminActorUserId,
} from "@/lib/admin-access";
import { getActiveContextFromCookieHeader } from "@/lib/active-context";
import { isPartnerContextFromCookies } from "@/lib/partner-context";
import { shouldSkipGlobalApiRateLimit } from "@/lib/api-rate-limit-policy";
import {
  enforceGlobalApiRateLimit,
  enforcePublicPageRateLimit,
} from "@/lib/rate-limit";
import { WORKSPACE_USER_COOKIE } from "@/lib/cookie-constants";

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return NextResponse.redirect(url);
}

function applyActiveContextGuards(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const hasSession = request.cookies.get(AUTH_SESSION_COOKIE)?.value === "1";
  const context = getActiveContextFromCookieHeader(
    request.headers.get("cookie")
  );

  if (!hasSession) {
    return null;
  }

  const isAgentApp =
    pathname === "/agent-dashboard" ||
    pathname.startsWith("/agent-dashboard/") ||
    pathname.startsWith("/api/agent/");
  const isMerchantApp =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/kiosk" ||
    pathname.startsWith("/kiosk/");
  const isContextChooser =
    pathname === "/choose-context" || pathname.startsWith("/choose-context/");
  const isSessionApi =
    pathname.startsWith("/api/session/") ||
    pathname === "/api/users/sync" ||
    pathname === "/api/users/me" ||
    pathname === "/api/users/workspace-role";
  const isMerchantHydrationApi = pathname.startsWith("/api/dashboard/");

  if (context === "agent") {
    if (isMerchantHydrationApi) {
      return NextResponse.json(
        { error: "Merchant workspace APIs are unavailable in agent context." },
        { status: 403 }
      );
    }

    if (
      !isAgentApp &&
      !isContextChooser &&
      !isSessionApi &&
      !pathname.startsWith("/admin") &&
      !pathname.startsWith("/api/admin/")
    ) {
      if (isMerchantApp) {
        return redirectTo(request, "/agent-dashboard");
      }

      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Switch to merchant context to continue." },
          { status: 403 }
        );
      }
    }
  }

  if (isAgentApp && context !== "agent") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Switch to agent context to continue." },
        { status: 403 }
      );
    }

    return redirectTo(request, "/choose-context");
  }

  if (isMerchantApp && context === "agent") {
    return redirectTo(request, "/agent-dashboard");
  }

  return null;
}
function applyRoleRouteGuards(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const hasSession = request.cookies.get(AUTH_SESSION_COOKIE)?.value === "1";
  const role = request.cookies.get(APP_ROLE_COOKIE)?.value;

  if (
    hasSession &&
    (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) &&
    role === "field_staff"
  ) {
    return redirectTo(request, "/kiosk");
  }

  if (
    hasSession &&
    (pathname === "/kiosk" || pathname.startsWith("/kiosk/")) &&
    role &&
    role !== "field_staff"
  ) {
    return redirectTo(request, "/dashboard");
  }

  return null;
}

function applyPartnerWorkspaceRouteGuards(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const isStrictOwnerRoute =
    pathname === "/dashboard/billing" ||
    pathname.startsWith("/dashboard/billing/") ||
    pathname === "/dashboard/import" ||
    pathname.startsWith("/dashboard/import/");

  if (!isStrictOwnerRoute) {
    return null;
  }

  const actorUserId = request.cookies.get(ACTOR_USER_COOKIE)?.value ?? null;
  const workspaceUserId = request.cookies.get(WORKSPACE_USER_COOKIE)?.value ?? null;

  if (isPartnerContextFromCookies(actorUserId, workspaceUserId)) {
    return redirectTo(request, "/dashboard/vendors");
  }

  return null;
}

async function applyAdminRouteGuards(
  request: NextRequest
): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  const isAdminPage =
    pathname === "/admin" || pathname.startsWith("/admin/");
  const isAdminApi = pathname.startsWith("/api/admin/");

  if (!isAdminPage && !isAdminApi) {
    return null;
  }

  const cookieHeader = request.headers.get("cookie");

  if (!hasAuthSession(cookieHeader)) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    return redirectTo(request, "/login");
  }

  const actorUserId = resolveAdminActorUserId(cookieHeader);

  if (!actorUserId) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    return redirectTo(request, "/login");
  }

  const allowed = await isAuthorizedAdmin(actorUserId);

  if (!allowed) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    return redirectTo(request, "/dashboard");
  }

  return null;
}

function applyPartnerApiGuards(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  const isDestructive =
    (method === "POST" && pathname === "/api/users/delete-account") ||
    (method === "DELETE" && /^\/api\/businesses\/[^/]+$/.test(pathname));

  if (!isDestructive) {
    return null;
  }

  const actorUserId = request.cookies.get(ACTOR_USER_COOKIE)?.value ?? null;
  const workspaceUserId = request.cookies.get(WORKSPACE_USER_COOKIE)?.value ?? null;

  if (isPartnerContextFromCookies(actorUserId, workspaceUserId)) {
    return NextResponse.json(
      {
        error:
          "Forbidden. Partners cannot perform destructive actions in an assigned workspace.",
      },
      { status: 403 }
    );
  }

  return null;
}

const PUBLIC_RATE_LIMITED_PREFIXES = ["/pay/", "/portal/", "/q/"];

function isPublicRateLimitedPath(pathname: string): boolean {
  return PUBLIC_RATE_LIMITED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
}

function serviceUnavailableResponse(): NextResponse {
  return NextResponse.json(
    { error: "Service temporarily unavailable. Please try again later." },
    { status: 503 }
  );
}

export async function middleware(request: NextRequest) {
  try {
    const adminGuardResponse = await applyAdminRouteGuards(request);

    if (adminGuardResponse) {
      return adminGuardResponse;
    }

    const contextGuardResponse = applyActiveContextGuards(request);

    if (contextGuardResponse) {
      return contextGuardResponse;
    }

    const roleGuardResponse = applyRoleRouteGuards(request);

    if (roleGuardResponse) {
      return roleGuardResponse;
    }

    const partnerGuardResponse = applyPartnerWorkspaceRouteGuards(request);

    if (partnerGuardResponse) {
      return partnerGuardResponse;
    }

    const partnerApiGuardResponse = applyPartnerApiGuards(request);

    if (partnerApiGuardResponse) {
      return partnerApiGuardResponse;
    }

    const pathname = request.nextUrl.pathname;
    const isApiPath = pathname.startsWith("/api/");
    const isPublicPath = isPublicRateLimitedPath(pathname);

    if (!isApiPath && !isPublicPath) {
      return NextResponse.next();
    }

    if (isApiPath && shouldSkipGlobalApiRateLimit(pathname, request)) {
      return NextResponse.next();
    }

    try {
      const rateLimitResponse = isApiPath
        ? await enforceGlobalApiRateLimit(request)
        : await enforcePublicPageRateLimit(request);

      if (rateLimitResponse) {
        return rateLimitResponse;
      }
    } catch (error) {
      // The limiter already fails closed internally; reaching here means the
      // limiter itself threw, so treat the request as unprotected and reject.
      console.error(
        "[Recoverpe Middleware] Rate limiter threw — failing closed:",
        error instanceof Error ? error.message : error
      );

      return serviceUnavailableResponse();
    }

    return NextResponse.next();
  } catch (error) {
    console.error(
      "[Recoverpe Middleware] Unexpected failure — fail-open:",
      error instanceof Error ? error.stack ?? error.message : error
    );

    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/api/:path*",
    "/admin",
    "/admin/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/kiosk",
    "/kiosk/:path*",
    "/choose-context",
    "/agent-dashboard",
    "/agent-dashboard/:path*",
    "/pay/:path*",
    "/portal/:path*",
    "/q/:path*",
  ],
};
