import { getAuthHeaders } from "@/lib/auth-headers";
import {
  ApprovePendingOnboardResponse,
  PendingOnboardsResponse,
} from "@/types";

export async function fetchPendingOnboards(
  businessId: string
): Promise<PendingOnboardsResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ business_id: businessId });
  const response = await fetch(`/api/pending-onboards?${params.toString()}`, {
    headers,
  });
  const body = (await response.json()) as PendingOnboardsResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to load onboarding queue.");
  }

  return body;
}

export async function approvePendingOnboard(
  pendingOnboardId: string,
  amount?: number
): Promise<ApprovePendingOnboardResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `/api/pending-onboards/${pendingOnboardId}/approve`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(amount !== undefined ? { amount } : {}),
    }
  );
  const body = (await response.json()) as ApprovePendingOnboardResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error || "Failed to approve customer.");
  }

  return body;
}
