import { getAuthHeaders } from "@/lib/auth-headers";
import { parseApiJsonResponse } from "@/lib/parse-api-response";
import {
  DiagnosticsHealthResponse,
  SimulatePaymentPayload,
} from "@/types";

export async function fetchDiagnosticsHealth(): Promise<DiagnosticsHealthResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/diagnostics/health", { headers });
  const body = await parseApiJsonResponse<
    DiagnosticsHealthResponse & { error?: string }
  >(response);

  if (!response.ok || !body.services) {
    throw new Error(body.error || "Failed to load integration health.");
  }

  return body;
}

export async function simulateSmartCollectPayment(
  payload: SimulatePaymentPayload
): Promise<Record<string, unknown>> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/dev/simulate-payment", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await parseApiJsonResponse<Record<string, unknown> & { error?: string }>(
    response
  );

  if (!response.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : "Failed to simulate Smart Collect payment."
    );
  }

  return body;
}
