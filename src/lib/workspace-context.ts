import { getPostLoginRoute } from "@/lib/kiosk-client";
import { getAppRoleFromDocument, setAppRoleCookie } from "@/lib/auth-cookies";
import {
  WORKSPACE_BUSINESS_COOKIE,
  WORKSPACE_USER_COOKIE,
} from "@/lib/cookie-constants";
import { AppRole } from "@/types";

export { WORKSPACE_USER_COOKIE, WORKSPACE_BUSINESS_COOKIE };

export const MULTI_WORKSPACE_TOAST_KEY = "recoverpe_multi_workspace_toast_shown";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function setWorkspaceCookies(
  workspaceUserId: string,
  businessId: string | null
): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${WORKSPACE_USER_COOKIE}=${workspaceUserId}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;

  if (businessId) {
    document.cookie = `${WORKSPACE_BUSINESS_COOKIE}=${businessId}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  } else {
    document.cookie = `${WORKSPACE_BUSINESS_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function clearWorkspaceCookies(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${WORKSPACE_USER_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `${WORKSPACE_BUSINESS_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function getWorkspaceCookiesFromDocument(): {
  workspaceUserId: string | null;
  businessId: string | null;
} {
  if (typeof document === "undefined") {
    return { workspaceUserId: null, businessId: null };
  }

  const cookies = Object.fromEntries(
    document.cookie.split(";").map((entry) => {
      const [key, ...valueParts] = entry.trim().split("=");
      return [key, decodeURIComponent(valueParts.join("="))];
    })
  );

  return {
    workspaceUserId: cookies[WORKSPACE_USER_COOKIE] || null,
    businessId: cookies[WORKSPACE_BUSINESS_COOKIE] || null,
  };
}

export function getCookieValue(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((entry) => {
      const [key, ...valueParts] = entry.trim().split("=");
      return [key, decodeURIComponent(valueParts.join("="))];
    })
  );

  return cookies[name] || null;
}

export function hasShownMultiWorkspaceToast(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(MULTI_WORKSPACE_TOAST_KEY) === "1";
}

export function markMultiWorkspaceToastShown(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(MULTI_WORKSPACE_TOAST_KEY, "1");
}

/**
 * Restores workspace UI state from cookies.
 * @param actorUserId Supabase `users.id` for the signed-in actor (not Firebase UID).
 */
export function restoreWorkspaceContextFromCookies(actorUserId: string): {
  workspaceUserId: string | null;
  businessId: string | null;
  isOwnWorkspace: boolean;
  appRole: AppRole | null;
} {
  const cookies = getWorkspaceCookiesFromDocument();
  const roleValue = getAppRoleFromDocument();
  const appRole = roleValue ? (roleValue as AppRole) : null;
  const workspaceUserId = cookies.workspaceUserId;
  const isOwnWorkspace = !workspaceUserId || workspaceUserId === actorUserId;

  return {
    workspaceUserId,
    businessId: cookies.businessId,
    isOwnWorkspace,
    appRole,
  };
}

export function completeWorkspaceSwitch(
  workspaceUserId: string,
  businessId: string | null,
  role: AppRole
): void {
  setWorkspaceCookies(workspaceUserId, businessId || null);
  setAppRoleCookie(role);

  if (typeof window === "undefined") {
    return;
  }

  const targetRoute = getPostLoginRoute(role);

  if (window.location.pathname === targetRoute) {
    window.location.reload();
    return;
  }

  window.location.assign(targetRoute);
}
