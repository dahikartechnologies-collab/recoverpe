import { getAuthHeaders } from "@/lib/businesses";
import { PaymentPromiseRecord, PaymentPromisesListResponse, PromiseStatus } from "@/types";

export async function fetchPaymentPromises(
  businessId: string,
  status?: PromiseStatus
): Promise<PaymentPromiseRecord[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ business_id: businessId });

  if (status) {
    params.set("status", status);
  }

  const response = await fetch(`/api/promises?${params.toString()}`, { headers });
  const body = (await response.json()) as PaymentPromisesListResponse & {
    error?: string;
  };

  if (!response.ok || !body.promises) {
    throw new Error(body.error || "Failed to load payment promises.");
  }

  return body.promises;
}

export async function updatePaymentPromiseStatus(
  promiseId: string,
  status: Extract<PromiseStatus, "kept" | "broken" | "void">
): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/promises/${promiseId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ status }),
  });

  const body = (await response.json()) as { success?: boolean; error?: string };

  if (!response.ok || !body.success) {
    throw new Error(body.error || "Failed to update promise.");
  }
}
