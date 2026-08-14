import { getAuthHeaders } from "@/lib/businesses";
import {
  InitiateVapiCallPayload,
  InitiateVapiCallResponse,
} from "@/types";

export async function initiateVapiCall(
  payload: InitiateVapiCallPayload
): Promise<InitiateVapiCallResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/vapi/call", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as InitiateVapiCallResponse & {
    error?: string;
    required_credits?: number;
    vapi_wallet_balance?: number;
  };

  if (response.status === 402) {
    throw new Error(
      body.error ||
        "Insufficient AI credits. Please top up your wallet to initiate a call."
    );
  }

  if (!response.ok || !body.success) {
    throw new Error(body.error || "Failed to initiate AI voice call.");
  }

  return body;
}
