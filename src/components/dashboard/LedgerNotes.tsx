"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  createLedgerNote,
  fetchLedgerNotes,
} from "@/lib/ledger-notes-client";
import { canMutateLedgers } from "@/lib/workspace-permissions";
import { useWorkspaceStore } from "@/store/workspace-store";
import { LedgerNote } from "@/types";

interface LedgerNotesProps {
  ledgerId: string;
  compact?: boolean;
}

function formatNoteTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function LedgerNotes({ ledgerId, compact = false }: LedgerNotesProps) {
  const workspaceRole = useWorkspaceStore((state) => state.workspaceRole);
  const customPermissions = useWorkspaceStore((state) => state.customPermissions);
  const [notes, setNotes] = useState<LedgerNote[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const readOnly = !canMutateLedgers(workspaceRole, customPermissions);

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const loadedNotes = await fetchLedgerNotes(ledgerId);
      setNotes(loadedNotes);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load notes."
      );
    } finally {
      setIsLoading(false);
    }
  }, [ledgerId]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const noteText = draft.trim();

    if (!noteText) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const note = await createLedgerNote(ledgerId, noteText);
      setNotes((current) => [...current, note]);
      setDraft("");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to post note."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div>
        <h3 className="text-sm font-semibold text-recoverpe-black">Internal Notes</h3>
        <p className="mt-1 text-xs text-recoverpe-grey-medium">
          Team-only updates visible to workspace members.
        </p>
      </div>

      <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-recoverpe-grey-light p-3">
        {isLoading ? (
          <p className="text-sm text-recoverpe-grey-medium">Loading notes...</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-recoverpe-grey-medium">
            No internal notes yet.
          </p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="rounded-md border border-recoverpe-grey-light px-3 py-2"
            >
              <p className="text-sm text-recoverpe-black">{note.note_text}</p>
              <p className="mt-1 text-xs text-recoverpe-grey-medium">
                {note.author_name}: {formatNoteTimestamp(note.created_at)}
              </p>
            </div>
          ))
        )}
      </div>

      {readOnly ? (
        <p className="text-xs text-recoverpe-grey-medium">
          Accountant access is read-only. You can review notes but cannot post new ones.
        </p>
      ) : (
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => void handleSubmit(event)}>
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add an internal update..."
            disabled={isSubmitting}
          />
          <Button type="submit" disabled={isSubmitting || !draft.trim()}>
            {isSubmitting ? "Posting..." : "Post note"}
          </Button>
        </form>
      )}

      {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}
    </div>
  );
}
