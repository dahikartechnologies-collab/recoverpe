import { NextResponse } from "next/server";

const DATABASE_ERROR_MESSAGE =
  "Database verification failed. Please try again.";

export function logAndRespondDatabaseError(
  scope: string,
  error: unknown,
  options?: { status?: number; message?: string }
): NextResponse {
  console.error(`[${scope}]`, error);

  return NextResponse.json(
    { error: options?.message ?? DATABASE_ERROR_MESSAGE },
    { status: options?.status ?? 500 }
  );
}

export function getSafeApiErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Free plan")) {
    return 402;
  }

  return 500;
}

export function getSafeApiErrorMessage(
  error: unknown,
  fallback = DATABASE_ERROR_MESSAGE
): string {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Free plan")) {
    return message;
  }

  return fallback;
}
