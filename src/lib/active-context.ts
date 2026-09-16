import { ACTIVE_CONTEXT_COOKIE } from "@/lib/cookie-constants";
import { AppRole } from "@/types";

export type ActiveContext = "merchant" | "agent";

export const ACTIVE_CONTEXT_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function isActiveContext(value: string | null | undefined): value is ActiveContext {
  return value === "merchant" || value === "agent";
}

export function parseActiveContext(value: string | null | undefined): ActiveContext | null {
  return isActiveContext(value) ? value : null;
}

export function getActiveContextFromCookieHeader(
  cookieHeader: string | null
): ActiveContext | null {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${ACTIVE_CONTEXT_COOKIE}=([^;]+)`)
  );

  return parseActiveContext(
    match?.[1] ? decodeURIComponent(match[1]) : null
  );
}

export function getActiveContextFromDocument(): ActiveContext | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = Object.fromEntries(
    document.cookie.split(";").map((entry) => {
      const [key, ...valueParts] = entry.trim().split("=");
      return [key, decodeURIComponent(valueParts.join("="))];
    })
  );

  return parseActiveContext(cookies[ACTIVE_CONTEXT_COOKIE] ?? null);
}

export function setActiveContextCookie(context: ActiveContext): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${ACTIVE_CONTEXT_COOKIE}=${context}; path=/; max-age=${ACTIVE_CONTEXT_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearActiveContextCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${ACTIVE_CONTEXT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export interface IdentitySurfaces {
  has_merchant: boolean;
  has_agent: boolean;
}

export type LandingPath =
  | "/choose-context"
  | "/agent-dashboard"
  | "/dashboard"
  | "/kiosk";

export function merchantHomePath(role: AppRole): "/dashboard" | "/kiosk" {
  return role === "field_staff" ? "/kiosk" : "/dashboard";
}

/**
 * After Firebase sync: one phone can be a shop owner and a RecoverPe agent.
 * Missing cookie is merchant for existing sessions.
 */
export function resolveLandingPath(input: {
  surfaces: IdentitySurfaces;
  role: AppRole;
  activeContext: ActiveContext | null;
  preferChooserWhenBoth?: boolean;
}): LandingPath {
  const { surfaces, role, activeContext, preferChooserWhenBoth = true } =
    input;

  if (surfaces.has_merchant && surfaces.has_agent) {
    if (preferChooserWhenBoth && !activeContext) {
      return "/choose-context";
    }

    if (activeContext === "agent") {
      return "/agent-dashboard";
    }

    return merchantHomePath(role);
  }

  if (surfaces.has_agent && !surfaces.has_merchant) {
    return "/agent-dashboard";
  }

  return merchantHomePath(role);
}

export function contextCookieHeaderValue(context: ActiveContext): string {
  return `${ACTIVE_CONTEXT_COOKIE}=${context}; Path=/; Max-Age=${ACTIVE_CONTEXT_MAX_AGE_SECONDS}; SameSite=Lax`;
}
