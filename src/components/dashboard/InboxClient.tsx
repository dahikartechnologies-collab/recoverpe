"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { getAuthHeaders } from "@/lib/auth-headers";
import { parseApiJsonResponse } from "@/lib/parse-api-response";
import { debtorHealthTier } from "@/lib/debtor-health";
import { InboxMessageRow, InboxThreadRow } from "@/lib/inbox-types";
import { useActiveBusinessEntitlements } from "@/lib/use-active-business-entitlement";
import { useWorkspaceStore } from "@/store/workspace-store";

function dhsLabel(score: number | null, canViewDhs: boolean): string {
  if (!canViewDhs) {
    return "DHS locked · Upgrade to Premium";
  }

  if (score === null) {
    return "DHS —";
  }

  const tier = debtorHealthTier(score);
  const labels = {
    reliable: "Reliable",
    watch: "Watch",
    chase: "Chase",
    cash_only: "Cash only",
  };

  return `DHS ${score} · ${labels[tier]}`;
}

function formatMessageStatus(status: string): string {
  switch (status) {
    case "read":
      return "Read";
    case "delivered":
      return "Delivered";
    case "sent":
      return "Sent";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function statusIndicator(status: string): string {
  switch (status) {
    case "read":
      return "✓✓";
    case "delivered":
      return "✓✓";
    case "sent":
      return "✓";
    case "failed":
      return "!";
    default:
      return "·";
  }
}

export function InboxClient() {
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const { hasEntitlement } = useActiveBusinessEntitlements();
  const canViewDhs = hasEntitlement("debtor_health_score");
  const [threads, setThreads] = useState<InboxThreadRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessageRow[]>([]);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const selected = threads.find((thread) => thread.contact_id === selectedId) ?? null;

  async function loadThreads() {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (activeBusinessId) {
      params.set("business_id", activeBusinessId);
    }
    const response = await fetch(`/api/inbox/threads?${params.toString()}`, {
      headers,
    });
    const body = await parseApiJsonResponse<{ threads: InboxThreadRow[] }>(
      response
    );
    setThreads(body.threads);
    if (!selectedId && body.threads[0]) {
      setSelectedId(body.threads[0].contact_id);
    }
  }

  async function loadThread(contactId: string) {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams();
    if (activeBusinessId) {
      params.set("business_id", activeBusinessId);
    }
    const response = await fetch(
      `/api/inbox/threads/${contactId}?${params.toString()}`,
      { headers }
    );
    const body = await parseApiJsonResponse<{ messages: InboxMessageRow[] }>(
      response
    );
    setMessages(body.messages);
  }

  useEffect(() => {
    void loadThreads().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load inbox."
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }

    void loadThread(selectedId).catch((loadError: unknown) => {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load thread."
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, activeBusinessId]);

  async function togglePause() {
    if (!selected) {
      return;
    }

    const headers = await getAuthHeaders();
    const response = await fetch(
      `/api/inbox/threads/${selected.contact_id}/pause`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ paused: !selected.bot_paused }),
      }
    );
    await parseApiJsonResponse(response);
    await loadThreads();
  }

  async function handleReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reply.trim()) {
      return;
    }

    const trimmedReply = reply.trim();
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: InboxMessageRow = {
      id: optimisticId,
      direction: "outbound",
      summary: trimmedReply,
      status: "sent",
      executed_at: new Date().toISOString(),
      external_message_id: null,
      proof_url: null,
      proof_status: null,
    };

    setIsSending(true);
    setError("");
    setReply("");
    setMessages((current) => [...current, optimisticMessage]);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `/api/inbox/threads/${selected.contact_id}/reply`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ body: trimmedReply }),
        }
      );
      const body = await parseApiJsonResponse<{
        ok: boolean;
        message: InboxMessageRow;
      }>(response);

      setMessages((current) =>
        current.map((message) =>
          message.id === optimisticId ? body.message : message
        )
      );
      await loadThreads();
    } catch (sendError) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticId)
      );
      setReply(trimmedReply);
      setError(
        sendError instanceof Error ? sendError.message : "Failed to send reply."
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="type-eyebrow">WhatsApp</p>
        <h1 className="type-page-title mt-2">Debtor inbox</h1>
        <p className="mt-2 max-w-2xl text-sm text-recoverpe-grey-medium">
          Last messages only — we do not store full chat bodies. Pause the bot
          to take over a conversation yourself.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-recoverpe-error">{error}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <CardContent className="p-0">
            {threads.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-5 w-5" aria-hidden />}
                title="No WhatsApp threads yet"
                description="When RecoverPe sends reminders or customers reply, their latest message summary appears here."
                action={
                  <Link href="/dashboard/vendors">
                    <Button>View vendors</Button>
                  </Link>
                }
              />
            ) : (
              <ul>
                {threads.map((thread) => (
                  <li key={thread.contact_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(thread.contact_id)}
                      className={`w-full border-b border-recoverpe-grey-light px-4 py-3 text-left ${
                        thread.contact_id === selectedId
                          ? "bg-recoverpe-grey-light"
                          : "bg-recoverpe-white"
                      }`}
                    >
                      <p className="text-sm font-medium text-recoverpe-black">
                        {thread.name}
                        {thread.unread ? " · new" : ""}
                      </p>
                      <p className="mt-1 truncate text-xs text-recoverpe-grey-medium">
                        {thread.last_summary || "No summary"}
                      </p>
                      <p className="mt-1 text-xs text-recoverpe-grey-medium">
                        {dhsLabel(thread.dhs, canViewDhs)}
                        {thread.bot_paused ? " · bot paused" : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-recoverpe-black">
                      {selected.name}
                    </h2>
                    <p className="text-sm text-recoverpe-grey-medium">
                      {selected.phone_number} · {dhsLabel(selected.dhs, canViewDhs)}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => void togglePause()}>
                    {selected.bot_paused ? "Resume bot" : "Pause bot"}
                  </Button>
                </div>

                <div className="max-h-[420px] space-y-3 overflow-y-auto border border-recoverpe-grey-light p-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[85%] text-sm ${
                        message.direction === "outbound" ? "ml-auto text-right" : ""
                      }`}
                    >
                      <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
                        {message.direction} · {statusIndicator(message.status)}{" "}
                        {formatMessageStatus(message.status)}
                      </p>
                      <p className="mt-1 text-recoverpe-black">
                        {message.summary || "—"}
                      </p>
                    </div>
                  ))}
                </div>

                <form className="flex gap-2" onSubmit={handleReply}>
                  <Input
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Owner reply — does not use Gemini"
                  />
                  <Button type="submit" disabled={isSending}>
                    {isSending ? "Sending…" : "Send"}
                  </Button>
                </form>
              </>
            ) : (
              <p className="text-sm text-recoverpe-grey-medium">
                Select a conversation.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
