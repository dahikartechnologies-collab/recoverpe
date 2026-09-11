import { withSentryConfig } from "@sentry/nextjs/config";

function assertProductionAppEnvSafety() {
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

assertProductionAppEnvSafety();

// 'unsafe-inline' and 'unsafe-eval' are required by Next's inline bootstrap
// and by the Razorpay, GA4, and Meta Pixel loaders. The value of this policy
// is therefore connect/frame/object restriction rather than script hardening.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  [
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "https://checkout.razorpay.com",
    "https://*.googletagmanager.com",
    "https://connect.facebook.net",
    "https://va.vercel-scripts.com",
  ].join(" "),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  [
    "connect-src 'self'",
    "https://*.googleapis.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://*.googletagmanager.com",
    "https://www.facebook.com",
    "https://*.razorpay.com",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://*.sentry.io",
    "https://*.ingest.sentry.io",
    "https://vitals.vercel-insights.com",
  ].join(" "),
  "frame-src 'self' https://*.razorpay.com https://*.firebaseapp.com",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["jwks-rsa", "jose", "firebase-admin"],
  experimental: {
    // Next 14 gates src/instrumentation.ts behind this flag; it is how the
    // Sentry server and edge clients get initialised.
    instrumentationHook: true,
    serverComponentsExternalPackages: [
      "@react-pdf/renderer",
      "jwks-rsa",
      "jose",
      "firebase-admin",
    ],
  },
  eslint: {
    // The lint debt this was hiding is cleared; keep it enforced so unused
    // bindings and hook-dependency mistakes cannot reach production again.
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

// Source map upload needs an auth token. Without one the build must still
// succeed, so the plugin is only given upload work when the token is present.
const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  telemetry: false,
};

export default withSentryConfig(nextConfig, sentryBuildOptions);
