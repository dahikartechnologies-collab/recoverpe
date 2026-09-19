export interface VapiWebRtcConfig {
  publicKey: string;
  assistantId: string;
  modelProvider: string;
  modelName: string;
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

  const modelProvider = process.env.VAPI_MODEL_PROVIDER?.trim() || "openai";
  const modelName = process.env.VAPI_MODEL_NAME?.trim() || "gpt-4o-mini";

  return {
    publicKey,
    assistantId,
    modelProvider,
    modelName,
    isConfigured: Boolean(publicKey && assistantId),
  };
}
