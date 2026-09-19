import { NextResponse } from "next/server";

const DATABASE_ERROR_MESSAGE =
  "Database verification failed. Please try again.";

export function logStructuredError(scope: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[${scope}]`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return;
  }

  console.error(`[${scope}]`, error);
}

export function logAndRespondDatabaseError(
  scope: string,
  error: unknown,
  options?: { status?: number; message?: string }
): NextResponse {
  logStructuredError(scope, error);

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
