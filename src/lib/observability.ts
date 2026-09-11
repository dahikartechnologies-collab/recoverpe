import * as Sentry from "@sentry/nextjs";

type ErrorContext = Record<string, string | number | boolean | null>;

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Reports a handled failure. Most integration errors here are caught and
 * absorbed so a webhook can still return 200 to the provider — without an
 * explicit report they would never surface anywhere but the function log.
 *
 * Context must stay free of debtor PII: pass ids, never phone numbers, names,
 * message bodies, or UTRs.
 */
export function captureHandledError(
  scope: string,
  error: unknown,
  context: ErrorContext = {}
): void {
  console.error(`[${scope}]`, toMessage(error), context);

  Sentry.captureException(error instanceof Error ? error : new Error(toMessage(error)), {
    tags: { scope },
    extra: context,
  });
}

/** Reports a degraded-but-not-thrown condition, e.g. a provider 4xx response. */
export function captureHandledWarning(
  scope: string,
  message: string,
  context: ErrorContext = {}
): void {
  console.warn(`[${scope}]`, message, context);

  Sentry.captureMessage(message, {
    level: "warning",
    tags: { scope },
    extra: context,
  });
}
