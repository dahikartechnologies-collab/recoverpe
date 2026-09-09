import {
  ACTOR_USER_COOKIE,
  APP_ROLE_COOKIE,
  AUTH_SESSION_COOKIE,
} from "@/lib/cookie-constants";

export { ACTOR_USER_COOKIE, APP_ROLE_COOKIE, AUTH_SESSION_COOKIE };

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const APP_ROLE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const ACTOR_USER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function setAuthSessionCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${AUTH_SESSION_COOKIE}=1; path=/; max-age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearAuthSessionCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${AUTH_SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function hasAuthSessionCookie(cookieHeader?: string | null): boolean {
  if (cookieHeader !== undefined) {
    return (cookieHeader ?? "").includes(`${AUTH_SESSION_COOKIE}=1`);
  }

  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie
    .split(";")
    .some((entry) => entry.trim() === `${AUTH_SESSION_COOKIE}=1`);
}

export function setAppRoleCookie(role: string): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${APP_ROLE_COOKIE}=${role}; path=/; max-age=${APP_ROLE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearAppRoleCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${APP_ROLE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function getAppRoleFromDocument(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = Object.fromEntries(
    document.cookie.split(";").map((entry) => {
      const [key, ...valueParts] = entry.trim().split("=");
      return [key, decodeURIComponent(valueParts.join("="))];
    })
  );

  return cookies[APP_ROLE_COOKIE] || null;
}

export function getAppRoleFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${APP_ROLE_COOKIE}=([^;]+)`)
  );

  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function setActorUserCookie(actorUserId: string): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${ACTOR_USER_COOKIE}=${encodeURIComponent(actorUserId)}; path=/; max-age=${ACTOR_USER_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearActorUserCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${ACTOR_USER_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function getActorUserIdFromCookieHeader(
  cookieHeader: string | null
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${ACTOR_USER_COOKIE}=([^;]+)`)
  );

  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function getActorUserIdFromDocument(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = Object.fromEntries(
    document.cookie.split(";").map((entry) => {
      const [key, ...valueParts] = entry.trim().split("=");
      return [key, decodeURIComponent(valueParts.join("="))];
    })
  );

  return cookies[ACTOR_USER_COOKIE] || null;
}
