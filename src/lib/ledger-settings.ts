import { getAuthHeaders } from "@/lib/businesses";
import { Ledger } from "@/types";

export async function updateLedgerCommunicationPaused(
  ledgerId: string,
  communicationPaused: boolean
): Promise<Ledger> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/ledgers/${ledgerId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ communication_paused: communicationPaused }),
  });

  const body = (await response.json()) as {
    ledger?: Ledger;
    error?: string;
  };

  if (!response.ok || !body.ledger) {
    throw new Error(body.error || "Failed to update automation settings.");
  }

  return body.ledger;
}
