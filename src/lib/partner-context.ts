import { ACTOR_USER_COOKIE, WORKSPACE_USER_COOKIE } from "@/lib/cookie-constants";

export function isPartnerContextFromCookies(
  actorUserId: string | null | undefined,
  workspaceUserId: string | null | undefined
): boolean {
  if (!actorUserId || !workspaceUserId) {
    return false;
  }

  return actorUserId !== workspaceUserId;
}

export function isOwnerOnlyDashboardPath(pathname: string): boolean {
  if (pathname === "/dashboard") {
    return true;
  }

  if (pathname === "/dashboard/import" || pathname.startsWith("/dashboard/import/")) {
    return true;
  }

  if (pathname === "/dashboard/billing" || pathname.startsWith("/dashboard/billing/")) {
    return true;
  }

  if (pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings/")) {
    return true;
  }

  return false;
}

export function readPartnerContextFromCookieHeader(cookieHeader: string | null): {
  actorUserId: string | null;
  workspaceUserId: string | null;
  isPartnerContext: boolean;
} {
  if (!cookieHeader) {
    return { actorUserId: null, workspaceUserId: null, isPartnerContext: false };
  }

  const actorMatch = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${ACTOR_USER_COOKIE}=([^;]+)`)
  );
  const workspaceMatch = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${WORKSPACE_USER_COOKIE}=([^;]+)`)
  );

  const actorUserId = actorMatch?.[1]
    ? decodeURIComponent(actorMatch[1])
    : null;
  const workspaceUserId = workspaceMatch?.[1]
    ? decodeURIComponent(workspaceMatch[1])
    : null;

  return {
    actorUserId,
    workspaceUserId,
    isPartnerContext: isPartnerContextFromCookies(actorUserId, workspaceUserId),
  };
}
