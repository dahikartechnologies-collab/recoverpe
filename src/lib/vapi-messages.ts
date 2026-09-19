export const VAPI_UNAVAILABLE_TOAST_MESSAGE =
  "Voice assistant is currently unavailable. Please check microphone permissions.";

export function formatVapiClientError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return VAPI_UNAVAILABLE_TOAST_MESSAGE;
  }

  const root = error as Record<string, unknown>;
  const nestedError =
    root.error && typeof root.error === "object"
      ? (root.error as Record<string, unknown>)
      : null;
  const apiError =
    nestedError?.error && typeof nestedError.error === "object"
      ? (nestedError.error as Record<string, unknown>)
      : null;

  const message =
    apiError?.message ??
    nestedError?.message ??
    root.message;

  if (Array.isArray(message)) {
    const text = message.filter((item) => typeof item === "string").join(" ");
    return text || VAPI_UNAVAILABLE_TOAST_MESSAGE;
  }

  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  return VAPI_UNAVAILABLE_TOAST_MESSAGE;
}
