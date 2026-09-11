import { NextRequest, NextResponse } from "next/server";
import {
  ACTOR_USER_COOKIE,
  APP_ROLE_COOKIE,
  AUTH_SESSION_COOKIE,
} from "@/lib/auth-cookies";
import { isPartnerContextFromCookies } from "@/lib/partner-context";
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

/**
 * Route guards use recoverpe_app_role, which WorkspaceSwitcher keeps in sync
 * with the selected workspace via completeWorkspaceSwitch().
 * recoverpe_auth_session is set client-side when Firebase restores a session.
 */
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
    "/dashboard",
    "/dashboard/:path*",
    "/kiosk",
    "/kiosk/:path*",
    "/pay/:path*",
    "/portal/:path*",
    "/q/:path*",
  ],
};
