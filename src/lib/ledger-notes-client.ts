import { getAuthHeaders } from "@/lib/auth-headers";
import { LedgerNote } from "@/types";

export async function fetchLedgerNotes(ledgerId: string): Promise<LedgerNote[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/ledgers/${ledgerId}/notes`, { headers });
  const body = (await response.json()) as { notes?: LedgerNote[]; error?: string };

  if (!response.ok) {
    throw new Error(body.error || "Failed to load ledger notes.");
  }

  return body.notes ?? [];
}

export async function createLedgerNote(
  ledgerId: string,
  noteText: string
): Promise<LedgerNote> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/ledgers/${ledgerId}/notes`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ note_text: noteText }),
  });

  const body = (await response.json()) as { note?: LedgerNote; error?: string };

  if (!response.ok || !body.note) {
    throw new Error(body.error || "Failed to add ledger note.");
  }

  return body.note;
}
