import { NextResponse } from "next/server";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import {
  requireAuthenticatedUser,
  requireSuperAdminUser,
} from "@/lib/api-auth";

export interface DiagnosticsAccess {
  userId: string;
  isSuperAdmin: boolean;
}

type DiagnosticsAccessResult =
  | DiagnosticsAccess
  | { error: NextResponse };

/**
 * Production: super-admin only (404 for everyone else to hide the endpoint).
 * Development: any authenticated user (APP_ENV=development dev flag).
 */
export async function requireDiagnosticsAccess(
  request: Request
): Promise<DiagnosticsAccessResult> {
  if (isDevelopmentAppEnv()) {
    const authResult = await requireAuthenticatedUser(request);

    if ("error" in authResult && authResult.error) {
      return { error: authResult.error };
    }

    return { userId: authResult.userId, isSuperAdmin: false };
  }

  const adminResult = await requireSuperAdminUser(request);

  if ("error" in adminResult) {
    return {
      error: NextResponse.json({ error: "Not found." }, { status: 404 }),
    };
  }

  return { userId: adminResult.userId, isSuperAdmin: true };
}
