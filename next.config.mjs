import { withSentryConfig } from "@sentry/nextjs";

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
    // Do not block Vercel production builds on lint debt in WIP routes.
    ignoreDuringBuilds: true,
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
  disableLogger: true,
  telemetry: false,
};

export default withSentryConfig(nextConfig, sentryBuildOptions);
