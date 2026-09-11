import {
  CreateLedgerPayload,
  Ledger,
  LedgerPagination,
  LedgersResponse,
  LedgerWithContact,
  RectifyLedgerPayload,
  WorkspaceMode,
} from "@/types";
import { trackLedgerCreated } from "@/lib/analytics-events";
import { getAuthHeaders, getAuthHeadersForUpload } from "@/lib/auth-headers";
import { parseApiJsonResponse } from "@/lib/parse-api-response";

export class UpgradeRequiredError extends Error {
  readonly upgradeRequired = true;

  constructor(message: string) {
    super(message);
    this.name = "UpgradeRequiredError";
  }
}

export async function createLedgerEntry(
  payload: CreateLedgerPayload
): Promise<Ledger> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/ledgers", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const body = await parseApiJsonResponse<{
    ledger?: Ledger;
    error?: string;
    upgrade_required?: boolean;
    is_first_ledger?: boolean;
  }>(response);

  if (response.status === 402 && body.upgrade_required) {
    throw new UpgradeRequiredError(
      body.error ||
        "Free plan invoice limit reached. Upgrade to Premium to add more."
    );
  }

  if (!response.ok || !body.ledger) {
    throw new Error(body.error || "Failed to create ledger entry.");
  }

  trackLedgerCreated({
    valueInr: Number(body.ledger.total_amount),
    isFirstLedger: Boolean(body.is_first_ledger),
  });

  return body.ledger;
}

export async function uploadCustomLedgerPdf(
  ledgerId: string,
  pdfFile: File
): Promise<Ledger> {
  const formData = new FormData();
  formData.append("pdf", pdfFile);

  const headers = await getAuthHeadersForUpload();
  const response = await fetch(`/api/ledgers/${ledgerId}/custom-pdf`, {
    method: "POST",
    headers,
    body: formData,
  });

  const body = (await response.json()) as {
    ledger?: Ledger;
    error?: string;
  };

  if (!response.ok || !body.ledger) {
    throw new Error(body.error || "Failed to upload custom PDF.");
  }

  return body.ledger;
}

export async function rectifyLedgerEntry(
  ledgerId: string,
  payload: RectifyLedgerPayload
): Promise<LedgerWithContact> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/ledgers/${ledgerId}/rectify`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as {
    ledger?: LedgerWithContact;
    error?: string;
  };

  if (!response.ok || !body.ledger) {
    throw new Error(body.error || "Failed to rectify ledger.");
  }

  return body.ledger;
}

export async function fetchLedgers(
  workspaceMode: WorkspaceMode,
  businessId: string | null,
  options?: { limit?: number; offset?: number; page?: number }
): Promise<LedgersResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ workspace_mode: workspaceMode });

  if (workspaceMode === "business" && businessId) {
    params.set("business_id", businessId);
  }

  if (options?.limit) {
    params.set("limit", String(options.limit));
  }

  if (options?.offset !== undefined) {
    params.set("offset", String(options.offset));
  } else if (options?.page) {
    params.set("page", String(options.page));
  }

  const response = await fetch(`/api/ledgers?${params.toString()}`, { headers });
  const body = await parseApiJsonResponse<LedgersResponse & { error?: string }>(
    response
  );

  if (!response.ok) {
    throw new Error(body.error || "Failed to load ledgers.");
  }

  const defaultPagination: LedgerPagination = {
    total: body.ledgers?.length ?? 0,
    limit: options?.limit ?? 50,
    offset: options?.offset ?? 0,
    page: options?.page ?? 1,
    hasMore: false,
  };

  return {
    ledgers: body.ledgers ?? [],
    metrics: body.metrics ?? {
      totalOutstanding: 0,
      severelyOverdue: 0,
      recoveredViaRecoverpe: 0,
    },
    pagination: body.pagination ?? defaultPagination,
  };
}

export async function fetchLedgerById(
  ledgerId: string
): Promise<LedgerWithContact> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/ledgers/${ledgerId}`, { headers });
  const body = (await response.json()) as {
    ledger?: LedgerWithContact;
    error?: string;
  };

  if (!response.ok || !body.ledger) {
    throw new Error(body.error || "Failed to load ledger.");
  }

  return body.ledger;
}
