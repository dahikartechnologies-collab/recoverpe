import { GHOST_MODE_USER_COOKIE } from "@/lib/cookie-constants";

const GHOST_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;

export function setGhostModeCookie(userId: string): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${GHOST_MODE_USER_COOKIE}=${encodeURIComponent(userId)}; path=/; max-age=${GHOST_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearGhostModeCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${GHOST_MODE_USER_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function buildGhostModeClearCookieHeader(): string {
  return `${GHOST_MODE_USER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
