import { getAuthHeaders } from "@/lib/businesses";
import {
  InitiateVapiCallPayload,
  InitiateVapiCallResponse,
} from "@/types";

export async function initiateVapiOutboundCall(
  payload: InitiateVapiCallPayload
): Promise<InitiateVapiCallResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/vapi/outbound", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ledgerId: payload.ledger_id,
      contactId: payload.contact_id,
      ledger_id: payload.ledger_id,
      contact_id: payload.contact_id,
    }),
  });

  const body = (await response.json()) as InitiateVapiCallResponse & {
    error?: string;
    upgrade_required?: boolean;
  };

  if (response.status === 403 && body.upgrade_required) {
    throw new Error(body.error || "Upgrade to Premium to use AI Voice Calls.");
  }

  if (response.status === 402) {
    throw new Error(
      body.error ||
        "Insufficient AI voice minutes for this billing period."
    );
  }

  if (!response.ok || !body.success) {
    throw new Error(body.error || "Failed to initiate AI voice call.");
  }

  return body;
}

/** @deprecated Use initiateVapiOutboundCall instead. */
export async function initiateVapiCall(
  payload: Pick<InitiateVapiCallPayload, "ledger_id"> & { contact_id?: string }
): Promise<InitiateVapiCallResponse> {
  if (!payload.contact_id) {
    throw new Error("contact_id is required for AI voice calls.");
  }

  return initiateVapiOutboundCall({
    ledger_id: payload.ledger_id,
    contact_id: payload.contact_id,
  });
}
