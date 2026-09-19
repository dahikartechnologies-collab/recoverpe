export interface VapiWebRtcConfig {
  publicKey: string;
  assistantId: string;
  isConfigured: boolean;
}

/**
 * Resolve WebRTC dialer credentials at request time so Vercel env vars work
 * without requiring a rebuild after every key rotation.
 *
 * Accepts either NEXT_PUBLIC_* (client bundle) or server-only aliases.
 */
export function resolveVapiWebRtcConfig(): VapiWebRtcConfig {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY?.trim() ||
    process.env.VAPI_PUBLIC_KEY?.trim() ||
    "";

  const assistantId =
    process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID?.trim() ||
    process.env.VAPI_ASSISTANT_ID?.trim() ||
    "";

  return {
    publicKey,
    assistantId,
    isConfigured: Boolean(publicKey && assistantId),
  };
}
