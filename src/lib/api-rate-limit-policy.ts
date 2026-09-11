/**
 * Edge rate limits exist to protect unauthenticated and webhook surfaces.
 * Authenticated dashboard APIs already verify a Firebase JWT in the route;
 * an extra Redis round-trip on every one of those calls is what makes the
 * app feel frozen (10+ Upstash hops per page).
 */

const ALWAYS_RATE_LIMITED_API_PREFIXES = [
  "/api/webhooks/",
  "/api/public/",
  "/api/pay/",
  "/api/cron/",
  "/api/dev/",
];

export function isAlwaysRateLimitedApiPath(pathname: string): boolean {
  return ALWAYS_RATE_LIMITED_API_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
}

export function hasBearerAuthorization(request: Request): boolean {
  const authorization = request.headers.get("authorization");
  return Boolean(
    authorization?.startsWith("Bearer ") && authorization.length > 40
  );
}

export function shouldSkipGlobalApiRateLimit(
  pathname: string,
  request: Request
): boolean {
  if (!pathname.startsWith("/api/")) {
    return false;
  }

  if (isAlwaysRateLimitedApiPath(pathname)) {
    return false;
  }

  return hasBearerAuthorization(request);
}
