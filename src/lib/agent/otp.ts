import { createHash, randomInt, timingSafeEqual } from "crypto";

export function generateAgentOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

export function hashAgentOtp(code: string): string {
  const pepper =
    process.env.AGENT_OTP_PEPPER?.trim() ||
    process.env.META_APP_SECRET?.trim() ||
    "recoverpe-agent-otp-dev";

  return createHash("sha256").update(`${pepper}:${code.trim()}`).digest("hex");
}

export function agentOtpMatches(code: string, storedHash: string): boolean {
  const computed = Buffer.from(hashAgentOtp(code), "utf8");
  const stored = Buffer.from(storedHash, "utf8");

  if (computed.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(computed, stored);
}

export function generateReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";

  for (let i = 0; i < 4; i += 1) {
    suffix += alphabet[randomInt(0, alphabet.length)];
  }

  return `RP-${suffix}`;
}

export function normalizeMerchantPhone(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  const last10 = digits.slice(-10);

  if (last10.length === 10) {
    return `+91${last10}`;
  }

  return `+${digits}`;
}

export function extractSixDigitOtp(messageText: string): string | null {
  const match = messageText.trim().match(/^(\d{6})$/);
  return match?.[1] ?? null;
}

export function expectedPremiumInr(discountBps: number, listPriceInr = 1999): number {
  const discounted = listPriceInr * (1 - discountBps / 10_000);
  return Math.round((discounted + Number.EPSILON) * 100) / 100;
}
