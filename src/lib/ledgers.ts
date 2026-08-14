import {
  CreateLedgerPayload,
  Ledger,
  LedgersResponse,
  LedgerWithContact,
  WorkspaceMode,
} from "@/types";
import { getAuthHeaders } from "@/lib/businesses";

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

  const body = (await response.json()) as {
    ledger?: Ledger;
    error?: string;
    upgrade_required?: boolean;
  };

  if (response.status === 402 && body.upgrade_required) {
    throw new UpgradeRequiredError(
      body.error ||
        "Free plan invoice limit reached. Upgrade to Premium to add more."
    );
  }

  if (!response.ok || !body.ledger) {
    throw new Error(body.error || "Failed to create ledger entry.");
  }

  return body.ledger;
}

export async function fetchLedgers(
  workspaceMode: WorkspaceMode,
  businessId: string | null
): Promise<LedgersResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ workspace_mode: workspaceMode });

  if (workspaceMode === "business" && businessId) {
    params.set("business_id", businessId);
  }

  const response = await fetch(`/api/ledgers?${params.toString()}`, { headers });
  const body = (await response.json()) as LedgersResponse & { error?: string };

  if (!response.ok) {
    throw new Error(body.error || "Failed to load ledgers.");
  }

  return {
    ledgers: body.ledgers ?? [],
    metrics: body.metrics ?? {
      totalOutstanding: 0,
      severelyOverdue: 0,
      recoveredViaRecoverpe: 0,
    },
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
