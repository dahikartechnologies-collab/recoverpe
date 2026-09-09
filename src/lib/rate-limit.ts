import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";
import { NextResponse } from "next/server";
import { isDevelopmentAppEnv } from "@/lib/app-env";

function getRedisCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token || !url.startsWith("https://")) {
    return null;
  }

  return { url, token };
}

export function isRateLimitRedisConfigured(): boolean {
  return getRedisCredentials() !== null;
}

function shouldFailClosedOnMissingRedis(): boolean {
  return !isDevelopmentAppEnv();
}

function getRedisClient(): Redis | null {
  const credentials = getRedisCredentials();

  if (!credentials) {
    return null;
  }

  return new Redis(credentials);
}

/** Lightweight connectivity probe for integration diagnostics. */
export async function pingRateLimitRedis(): Promise<boolean> {
  const redis = getRedisClient();

  if (!redis) {
    return false;
  }

  try {
    const response = await redis.ping();
    return response === "PONG";
  } catch {
    return false;
  }
}

function createLimiter(
  prefix: string,
  requests: number,
  window: `${number} m` | `${number} h` | `${number} s`
): Ratelimit | null {
  const redis = getRedisClient();

  if (!redis) {
    return null;
  }

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: `recoverpe:${prefix}`,
    analytics: true,
  });
}

const limiterCache = new Map<string, Ratelimit | null>();

function getLimiter(
  key: string,
  prefix: string,
  requests: number,
  window: `${number} m` | `${number} h` | `${number} s`
): Ratelimit | null {
  if (!limiterCache.has(key)) {
    limiterCache.set(key, createLimiter(prefix, requests, window));
  }

  return limiterCache.get(key) ?? null;
}

function getVapiCallLimiter(): Ratelimit | null {
  return getLimiter("vapi-call", "vapi-call", 5, "1 m");
}

function getWhatsappSendLimiter(): Ratelimit | null {
  return getLimiter("whatsapp-send", "whatsapp-send", 30, "1 h");
}

function getGlobalApiLimiter(): Ratelimit | null {
  return getLimiter("global-api", "global-api", 100, "1 m");
}

function getPublicOnboardLimiter(): Ratelimit | null {
  return getLimiter("public-onboard", "public-onboard", 10, "1 m");
}

function getPayVerifyUploadLimiter(): Ratelimit | null {
  return getLimiter("pay-verify-upload", "pay-verify-upload", 5, "1 h");
}

/** @deprecated Use getPublicOnboardLimiter() — kept for call-site compatibility. */
export const publicOnboardLimiter = {
  limit: async (identifier: string) => {
    const limiter = getPublicOnboardLimiter();

    if (!limiter) {
      return { success: true, reset: Date.now() + 60_000 };
    }

    return limiter.limit(identifier);
  },
};

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstHop = forwardedFor.split(",")[0]?.trim();
    if (firstHop) {
      return firstHop;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();

  if (realIp) {
    return realIp;
  }

  return "127.0.0.1";
}

function rateLimitExceededResponse(reset?: number): NextResponse {
  const retryAfterSeconds =
    reset !== undefined
      ? Math.max(1, Math.ceil((reset - Date.now()) / 1000))
      : 60;

  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}

function redisUnavailableResponse(costBearing: boolean): NextResponse | null {
  if (!shouldFailClosedOnMissingRedis()) {
    console.warn(
      "[Recoverpe Rate Limit] CRITICAL: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN missing — allowing request in development."
    );
    return null;
  }

  if (costBearing) {
    console.error(
      "[Recoverpe Rate Limit] CRITICAL: Redis unavailable — blocking cost-bearing route in production."
    );
  } else {
    console.error(
      "[Recoverpe Rate Limit] CRITICAL: Redis unavailable — blocking API request in production."
    );
  }

  return NextResponse.json(
    { error: "Service temporarily unavailable. Please try again later." },
    { status: 503 }
  );
}

function handleLimiterFailure(
  error: unknown,
  costBearing: boolean
): NextResponse | null {
  console.error(
    "[Recoverpe Rate Limit] Redis limiter failed:",
    error instanceof Error ? error.message : error
  );

  return redisUnavailableResponse(costBearing);
}

export async function enforceGlobalApiRateLimit(
  request: Request
): Promise<NextResponse | null> {
  const limiter = getGlobalApiLimiter();

  if (!limiter) {
    console.warn(
      "[Recoverpe Rate Limit] Redis not configured — skipping edge global API rate limit."
    );
    return null;
  }

  try {
    const ip = getClientIp(request);
    const result = await limiter.limit(ip);

    if (!result.success) {
      return rateLimitExceededResponse(result.reset);
    }

    return null;
  } catch (error) {
    console.error(
      "[Recoverpe Rate Limit] Edge global limiter failed — fail-open:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export async function enforceVapiCallRateLimit(
  userId: string
): Promise<NextResponse | null> {
  const limiter = getVapiCallLimiter();

  if (!limiter) {
    return redisUnavailableResponse(true);
  }

  try {
    const result = await limiter.limit(userId);

    if (!result.success) {
      return rateLimitExceededResponse(result.reset);
    }

    return null;
  } catch (error) {
    return handleLimiterFailure(error, true);
  }
}

export async function isWhatsAppSendAllowed(userId: string): Promise<boolean> {
  const limiter = getWhatsappSendLimiter();

  if (!limiter) {
    return !shouldFailClosedOnMissingRedis();
  }

  try {
    const result = await limiter.limit(userId);
    return result.success;
  } catch (error) {
    console.error(
      "[Recoverpe Rate Limit] WhatsApp limiter failed:",
      error instanceof Error ? error.message : error
    );

    return !shouldFailClosedOnMissingRedis();
  }
}

export async function enforceWhatsAppSendRateLimit(
  userId: string
): Promise<NextResponse | null> {
  const limiter = getWhatsappSendLimiter();

  if (!limiter) {
    return redisUnavailableResponse(true);
  }

  try {
    const result = await limiter.limit(userId);

    if (!result.success) {
      return rateLimitExceededResponse(result.reset);
    }

    return null;
  } catch (error) {
    return handleLimiterFailure(error, true);
  }
}

export async function enforcePayVerifyUploadRateLimit(
  request: Request
): Promise<NextResponse | null> {
  const limiter = getPayVerifyUploadLimiter();

  if (!limiter) {
    return redisUnavailableResponse(false);
  }

  try {
    const ip = getClientIp(request);
    const result = await limiter.limit(ip);

    if (!result.success) {
      return rateLimitExceededResponse(result.reset);
    }

    return null;
  } catch (error) {
    return handleLimiterFailure(error, false);
  }
}
