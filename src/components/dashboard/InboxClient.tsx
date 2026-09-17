"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { AiVoiceCallButton } from "@/components/dashboard/AiVoiceCallButton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { getAuthHeaders } from "@/lib/auth-headers";
import { parseApiJsonResponse } from "@/lib/parse-api-response";
import { debtorHealthTier } from "@/lib/debtor-health";
import { InboxMessageRow, InboxThreadRow } from "@/lib/inbox-types";
import { useActiveBusinessEntitlements } from "@/lib/use-active-business-entitlement";
import { useWorkspaceStore } from "@/store/workspace-store";

function dhsBadge(score: number | null, canViewDhs: boolean) {
  if (!canViewDhs) {
    return <Badge tone="neutral">DHS locked</Badge>;
  }

  if (score === null) {
    return <Badge tone="neutral">DHS —</Badge>;
  }

  const tier = debtorHealthTier(score);
  const tone =
    tier === "reliable"
      ? "success"
      : tier === "watch"
        ? "info"
        : tier === "chase"
          ? "warning"
          : "danger";
  const labels = {
    reliable: "Reliable",
    watch: "Watch",
    chase: "Chase",
    cash_only: "Cash only",
  };

  return (
    <Badge tone={tone}>
      DHS {score} · {labels[tier]}
    </Badge>
  );
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
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);

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
    setIsLoadingThreads(true);
    void loadThreads()
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load inbox."
        );
      })
      .finally(() => setIsLoadingThreads(false));
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
      <PageHeader
        eyebrow="WhatsApp"
        title="Debtor inbox"
        description="Last messages only — we do not store full chat bodies. Pause the bot to take over a conversation yourself."
      />

      {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

      <div className="grid min-h-[640px] overflow-hidden rounded-xl border border-recoverpe-line bg-recoverpe-white lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="border-b border-recoverpe-line lg:border-b-0 lg:border-r">
          {isLoadingThreads ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : threads.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-5 w-5" aria-hidden />}
              title="No WhatsApp threads yet"
              description="When RecoverPe sends reminders or customers reply, their latest message summary appears here."
              action={
                <Link href="/dashboard/vendors">
                  <Button size="sm">View vendors</Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-recoverpe-line">
              {threads.map((thread) => {
                const isActive = thread.contact_id === selectedId;

                return (
                  <li key={thread.contact_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(thread.contact_id)}
                      className={`rp-interactive w-full px-4 py-3 text-left ${
                        isActive
                          ? "border-l-2 border-recoverpe-black bg-recoverpe-fill"
                          : "border-l-2 border-transparent hover:bg-recoverpe-fill/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-recoverpe-black">
                          {thread.name}
                        </p>
                        {thread.unread ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-recoverpe-black" />
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-recoverpe-muted">
                        {thread.last_summary || "No summary"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {dhsBadge(thread.dhs, canViewDhs)}
                        {thread.bot_paused ? (
                          <Badge tone="warning">Bot paused</Badge>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex min-h-[420px] flex-col">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-recoverpe-line px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-recoverpe-black">
                    {selected.name}
                  </h2>
                  <p className="mt-1 font-mono text-sm tabular-nums text-recoverpe-muted">
                    {selected.phone_number}
                  </p>
                  <div className="mt-2">{dhsBadge(selected.dhs, canViewDhs)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selected.primary_ledger_id ? (
                    <AiVoiceCallButton
                      ledgerId={selected.primary_ledger_id}
                      contactId={selected.contact_id}
                      compact
                      onSuccess={() => setError("")}
                      onError={(message) => setError(message)}
                    />
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void togglePause()}
                  >
                    {selected.bot_paused ? "Resume bot" : "Pause bot"}
                  </Button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-recoverpe-canvas p-4">
                {messages.map((message) => {
                  const outbound = message.direction === "outbound";

                  return (
                    <div
                      key={message.id}
                      className={`max-w-[85%] ${outbound ? "ml-auto" : ""}`}
                    >
                      <p className="mb-1 text-[11px] uppercase tracking-wider text-recoverpe-subtle">
                        {message.direction} · {formatMessageStatus(message.status)}
                      </p>
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm ${
                          outbound
                            ? "rounded-br-md bg-recoverpe-black text-recoverpe-white"
                            : "rounded-bl-md bg-recoverpe-white text-recoverpe-black"
                        }`}
                      >
                        {message.summary || "—"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                className="flex gap-2 border-t border-recoverpe-line bg-recoverpe-white p-3"
                onSubmit={handleReply}
              >
                <Input
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Owner reply — does not use Gemini"
                />
                <Button type="submit" size="sm" disabled={isSending}>
                  {isSending ? "Sending…" : "Send"}
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <p className="text-sm text-recoverpe-muted">
                Select a conversation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
