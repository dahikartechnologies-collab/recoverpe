import { getAuthHeaders } from "@/lib/businesses";
import { BatchImportPayload, BatchImportResponse } from "@/types";

export class BatchUpgradeRequiredError extends Error {
  readonly upgradeRequired = true;

  constructor(message: string) {
    super(message);
    this.name = "BatchUpgradeRequiredError";
  }
}

export async function importLedgerBatch(
  payload: BatchImportPayload
): Promise<BatchImportResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/ledgers/batch", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as BatchImportResponse & {
    error?: string;
    upgrade_required?: boolean;
  };

  if (response.status === 402 && body.upgrade_required) {
    throw new BatchUpgradeRequiredError(
      body.error ||
        "This import exceeds your free plan limit. Upgrade to Premium to continue."
    );
  }

  if (response.status === 413) {
    throw new Error(body.error || "Import payload exceeds the 5 MB max limit.");
  }

  if (!response.ok || !body.success) {
    throw new Error(body.error || "Failed to import CSV batch.");
  }

  return body;
}
