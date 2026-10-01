import { NextResponse } from "next/server";

const DATABASE_ERROR_MESSAGE =
  "Database verification failed. Please try again.";

export function logStructuredError(scope: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[${scope}]`, {
      name: error.name,
      message: error.message,
      ...(process.env.NODE_ENV === "production" ? {} : { stack: error.stack }),
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

const SCHEMA_LEAK_PATTERN =
  /\b(relation|column|permission denied|duplicate key|violates|PGRST|schema cache|42P01|22P02|42703)\b/i;

export function getSafeApiErrorMessage(
  error: unknown,
  fallback = DATABASE_ERROR_MESSAGE
): string {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Free plan")) {
    return message;
  }

  if (process.env.NODE_ENV === "production" || SCHEMA_LEAK_PATTERN.test(message)) {
    return fallback;
  }

  return message.trim() || fallback;
}
