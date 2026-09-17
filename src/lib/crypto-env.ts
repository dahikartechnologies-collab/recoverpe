export type CryptoVerificationResult =
  | { ok: true }
  | { ok: false; reason: string; missingEnv?: string };

export function requireEnvKey(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    console.error(`[Recoverpe Crypto] Missing environment variable: ${name}`);
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export function logCryptoVerificationFailure(
  scope: string,
  error: unknown,
  missingEnv?: string
): void {
  if (missingEnv) {
    console.error(
      `[Recoverpe Crypto] ${scope} failed because ${missingEnv} is not configured.`,
      error instanceof Error ? error.message : error
    );
    return;
  }

  console.error(
    `[Recoverpe Crypto] ${scope} verification failed:`,
    error instanceof Error ? error.message : error
  );
}

export function normalizeFirebasePrivateKey(
  rawKey: string | undefined
): string | null {
  if (!rawKey?.trim()) {
    console.error(
      "[Recoverpe Crypto] Missing environment variable: FIREBASE_ADMIN_PRIVATE_KEY"
    );
    return null;
  }

  const normalized = rawKey.replace(/\\n/g, "\n").trim();

  if (
    !normalized.includes("BEGIN PRIVATE KEY") &&
    !normalized.includes("BEGIN RSA PRIVATE KEY")
  ) {
    console.error(
      "[Recoverpe Crypto] FIREBASE_ADMIN_PRIVATE_KEY is malformed (missing PEM header)."
    );
    return null;
  }

  return normalized;
}
