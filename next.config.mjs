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
  experimental: {
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
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

export default nextConfig;
