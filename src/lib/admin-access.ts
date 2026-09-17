import { AUTH_SESSION_COOKIE } from "@/lib/cookie-constants";
import { getActorUserIdFromCookieHeader } from "@/lib/auth-cookies";

export const FOUNDER_ADMIN_EMAIL = "dahikartechnologies@gmail.com";

function readCookieValue(
  cookieHeader: string | null,
  name: string
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function hasAuthSession(cookieHeader: string | null): boolean {
  return readCookieValue(cookieHeader, AUTH_SESSION_COOKIE) === "1";
}

export function resolveAdminActorUserId(
  cookieHeader: string | null
): string | null {
  return getActorUserIdFromCookieHeader(cookieHeader);
}

export async function isAuthorizedAdmin(actorUserId: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "[Recoverpe Admin Guard] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
    return false;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(actorUserId)}&select=is_super_admin,email`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(
        "[Recoverpe Admin Guard] Supabase lookup failed with status",
        response.status
      );
      return false;
    }

    const rows = (await response.json()) as Array<{
      is_super_admin?: boolean;
      email?: string;
    }>;
    const user = rows[0];

    if (!user) {
      return false;
    }

    return (
      Boolean(user.is_super_admin) ||
      user.email?.trim().toLowerCase() === FOUNDER_ADMIN_EMAIL.toLowerCase()
    );
  } catch (error) {
    console.error(
      "[Recoverpe Admin Guard] Failed to verify admin access:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}
