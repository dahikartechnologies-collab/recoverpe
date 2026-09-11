import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

// Without a DSN the SDK is inert, so local and preview runs behave exactly as
// they did before Sentry was added.
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV || process.env.VERCEL_ENV || "development",
    tracesSampleRate: 0.1,
    // Payloads here carry debtor phone numbers and message bodies.
    sendDefaultPii: false,
  });
}
