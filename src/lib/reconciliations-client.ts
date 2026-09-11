import { getAuthHeaders } from "@/lib/auth-headers";
import { ReconciliationStatus } from "@/types";

export interface ReconciliationQueueEntry {
  id: string;
  status: ReconciliationStatus;
  extracted_utr: string | null;
  extracted_amount: number | null;
  extracted_date: string | null;
  created_at: string;
  contact_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  ledger_id: string | null;
  suggested_invoice: string | null;
  suggested_invoice_balance: number | null;
  /** Short-lived signed URL, or null when the image could not be retained. */
  proof_url: string | null;
  source: string;
}

export async function fetchReconciliations(
  status: ReconciliationStatus = "pending_review"
): Promise<ReconciliationQueueEntry[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/reconciliations?status=${status}`, {
    headers,
  });
  const payload = (await response.json()) as {
    reconciliations?: ReconciliationQueueEntry[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Failed to load reconciliations.");
  }

  return payload.reconciliations ?? [];
}

export async function reviewReconciliation(
  id: string,
  action: "approve" | "reject"
): Promise<{ settled_amount: number }> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/reconciliations", {
    method: "PATCH",
    headers,
    body: JSON.stringify({ id, action }),
  });
  const payload = (await response.json()) as {
    settled_amount?: number;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Failed to review this claim.");
  }

  return { settled_amount: payload.settled_amount ?? 0 };
}
