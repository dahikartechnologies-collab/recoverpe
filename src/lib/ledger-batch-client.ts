import { getAuthHeaders } from "@/lib/businesses";
import { CSV_IMPORT_BATCH_ROW_LIMIT } from "@/lib/csv-import";
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
    code?: string;
  };

  if (
    response.status === 403 &&
    body.code === "ACCOUNT_SUSPENDED"
  ) {
    throw new Error(body.error || "Account suspended by administrator");
  }

  if (
    response.status === 403 &&
    body.code === "ACCOUNT_PENDING_PURGE"
  ) {
    throw new Error(body.error || "Account scheduled for deletion.");
  }

  if (response.status === 402 && body.upgrade_required) {
    throw new BatchUpgradeRequiredError(
      body.error ||
        "This import exceeds your free plan limit. Upgrade to Premium to continue."
    );
  }

  if (response.status === 413) {
    throw new Error(body.error || "Import payload exceeds the 2 MB max limit.");
  }

  if (!response.ok || !body.success) {
    throw new Error(body.error || "Failed to import CSV batch.");
  }

  return body;
}

export async function importLedgerBatchChunked(
  payload: BatchImportPayload
): Promise<BatchImportResponse> {
  if (payload.rows.length <= CSV_IMPORT_BATCH_ROW_LIMIT) {
    return importLedgerBatch(payload);
  }

  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let contactCount = 0;

  for (
    let offset = 0;
    offset < payload.rows.length;
    offset += CSV_IMPORT_BATCH_ROW_LIMIT
  ) {
    const rows = payload.rows.slice(offset, offset + CSV_IMPORT_BATCH_ROW_LIMIT);
    const result = await importLedgerBatch({
      ...payload,
      rows,
    });

    importedCount += result.imported_count;
    updatedCount += result.updated_count;
    skippedCount += result.skipped_count;
    contactCount += result.contact_count;
  }

  return {
    success: true,
    imported_count: importedCount,
    updated_count: updatedCount,
    skipped_count: skippedCount,
    contact_count: contactCount,
    message:
      updatedCount > 0
        ? `${importedCount} invoice(s) imported, ${updatedCount} updated.`
        : `${importedCount} invoice(s) imported successfully.`,
  };
}
