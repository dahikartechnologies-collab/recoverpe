/** Server-only application environment. Never expose via NEXT_PUBLIC_* vars. */
export function isDevelopmentAppEnv(): boolean {
  return process.env.APP_ENV === "development";
}

/**
 * Refuses to boot when APP_ENV=development is configured on a live Vercel
 * production deployment. Dev mode bypasses WhatsApp, Razorpay, and VAPI — a
 * mis-set variable there would silently drop real customer traffic.
 */
export function assertProductionAppEnvSafety(): void {
  if (
    process.env.VERCEL_ENV === "production" &&
    process.env.APP_ENV === "development"
  ) {
    const banner = [
      "",
      "════════════════════════════════════════════════════════════════",
      " FATAL: APP_ENV=development on a Vercel production deployment.",
      " External integrations will run in dev-bypass mode.",
      " Set APP_ENV=production in the Vercel project environment.",
      "════════════════════════════════════════════════════════════════",
      "",
    ].join("\n");

    console.error(banner);

    throw new Error(
      "APP_ENV=development must not be used when VERCEL_ENV=production."
    );
  }
}
