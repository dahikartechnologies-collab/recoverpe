import { Redis } from "@upstash/redis/cloudflare";
import { isDevelopmentAppEnv } from "@/lib/app-env";

const WAMID_TTL_SECONDS = 86_400;

function getRedisCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token || !url.startsWith("https://")) {
    return null;
  }

  return { url, token };
}

function getRedisClient(): Redis | null {
  const credentials = getRedisCredentials();

  if (!credentials) {
    return null;
  }

  return new Redis(credentials);
}

export function whatsAppWamidKey(wamid: string): string {
  return `whatsapp:msg:${wamid}`;
}

/**
 * First writer wins. Meta retries the same inbound payload when the handler
 * is slow; claiming the wamid before Gemini/send makes those retries no-ops.
 *
 * Returns true when this process owns the message and may dispatch a reply.
 */
export async function claimWhatsAppWamid(wamid: string): Promise<boolean> {
  const trimmed = wamid.trim();

  if (!trimmed) {
    return false;
  }

  const redis = getRedisClient();

  if (!redis) {
    if (isDevelopmentAppEnv()) {
      console.warn(
        "[WHATSAPP WEBHOOK] Redis missing — skipping wamid claim in development."
      );
      return true;
    }

    console.error(
      "[WHATSAPP WEBHOOK] Redis missing — refusing inbound dispatch without wamid idempotency."
    );
    return false;
  }

  try {
    const exists = await redis.set(whatsAppWamidKey(trimmed), "1", {
      nx: true,
      ex: WAMID_TTL_SECONDS,
    });

    return Boolean(exists);
  } catch (error) {
    console.error(
      "[WHATSAPP WEBHOOK] wamid claim failed:",
      error instanceof Error ? error.message : error
    );

    if (isDevelopmentAppEnv()) {
      return true;
    }

    return false;
  }
}
