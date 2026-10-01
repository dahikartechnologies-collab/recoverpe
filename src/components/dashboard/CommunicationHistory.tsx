"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  Clock,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAuthHeaders } from "@/lib/auth-headers";
import {
  CommunicationChannel,
  CommunicationLog,
  CommunicationStatus,
  WhatsAppMessageType,
} from "@/types";

interface CommunicationHistoryProps {
  contactId: string;
}

// WhatsApp's own read-receipt blue, so merchants recognise "seen" at a glance.
const READ_TICK_COLOR = "#34B7F1";

const CHANNEL_ICON: Record<CommunicationChannel, typeof MessageSquare> = {
  whatsapp: MessageSquare,
  sms: MessageSquare,
  email: Mail,
  voice: Phone,
  voice_ai: Phone,
};

const CHANNEL_LABEL: Record<CommunicationChannel, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Email",
  voice: "Voice call",
  voice_ai: "AI voice call",
};

const STATUS_LABEL: Record<CommunicationStatus, string> = {
  pending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
  call_completed: "Completed",
};

const MESSAGE_TYPE_LABEL: Record<WhatsAppMessageType, string> = {
  reminder: "Reminder",
  receipt: "Receipt",
  legal_notice: "Legal notice",
  reply: "Reply",
  parchi: "Parchi",
  marketing: "Promotion",
};

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function DeliveryStatus({ entry }: { entry: CommunicationLog }) {
  const { status } = entry;

  if (status === "failed") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium text-recoverpe-error"
        title={entry.failure_reason ?? undefined}
      >
        <AlertCircle className="h-3.5 w-3.5" aria-hidden />
        {STATUS_LABEL.failed}
      </span>
    );
  }

  if (status === "read") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium"
        style={{ color: READ_TICK_COLOR }}
        title={entry.read_at ? `Read ${formatTimestamp(entry.read_at)}` : "Read"}
      >
        <CheckCheck className="h-4 w-4" aria-hidden />
        {STATUS_LABEL.read}
      </span>
    );
  }

  if (status === "delivered") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium text-recoverpe-grey-medium"
        title={
          entry.delivered_at ? `Delivered ${formatTimestamp(entry.delivered_at)}` : "Delivered"
        }
      >
        <CheckCheck className="h-4 w-4" aria-hidden />
        {STATUS_LABEL.delivered}
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-recoverpe-grey-medium">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        {STATUS_LABEL.pending}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-recoverpe-grey-medium">
      <Check className="h-4 w-4" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function CommunicationHistory({ contactId }: CommunicationHistoryProps) {
  const [entries, setEntries] = useState<CommunicationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      setError("");

      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`/api/vendors/${contactId}/communications`, {
          headers,
        });
        const payload = (await response.json()) as {
          communications?: CommunicationLog[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load communication history.");
        }

        setEntries(payload.communications ?? []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load communication history."
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [contactId]
  );

  useEffect(() => {
    void loadHistory("initial");
  }, [loadHistory]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-recoverpe-grey-medium">
            Loading communication history...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error && entries.length === 0) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-recoverpe-error">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="flex justify-end border-b border-recoverpe-grey-light px-5 py-3">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void loadHistory("refresh")}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                aria-hidden
              />
              Refresh
            </Button>
          </div>
          <EmptyState
            title="No WhatsApp messages yet"
            description="No automated or manual WhatsApp messages sent to this contact yet."
            icon={<MessageSquare className="h-5 w-5" aria-hidden />}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b border-recoverpe-grey-light px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-recoverpe-grey-medium">
            <span className="inline-flex items-center gap-1">
              <Check className="h-3.5 w-3.5" aria-hidden /> Sent
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Delivered
            </span>
            <span className="inline-flex items-center gap-1" style={{ color: READ_TICK_COLOR }}>
              <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Read
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void loadHistory("refresh")}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden
            />
            Refresh
          </Button>
        </div>

        {error ? <p className="px-5 pt-3 text-sm text-recoverpe-error">{error}</p> : null}

        <ol className="divide-y divide-recoverpe-grey-light">
            {entries.map((entry) => {
              const ChannelIcon = CHANNEL_ICON[entry.channel] ?? MessageSquare;
              const isInbound = entry.direction === "inbound";
              const DirectionIcon = isInbound ? ArrowDownLeft : ArrowUpRight;
              const body = entry.message_body?.trim();
              const typeLabel = entry.message_type
                ? MESSAGE_TYPE_LABEL[entry.message_type]
                : null;

              return (
                <li key={entry.id} className="flex gap-3 px-5 py-4">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-recoverpe-grey-light">
                    <ChannelIcon className="h-4 w-4 text-recoverpe-black" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <DirectionIcon
                        className="h-3.5 w-3.5 text-recoverpe-grey-medium"
                        aria-hidden
                      />
                      <span className="text-sm font-medium text-recoverpe-black">
                        {isInbound ? "Received" : "Sent"} &middot;{" "}
                        {CHANNEL_LABEL[entry.channel] ?? entry.channel}
                      </span>
                      {typeLabel ? (
                        <span className="rounded border border-recoverpe-grey-light px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-recoverpe-grey-medium">
                          {typeLabel}
                        </span>
                      ) : null}
                    </div>

                    {body ? (
                      <div
                        className={`mt-2 max-w-xl rounded-lg border px-3 py-2 ${
                          isInbound
                            ? "border-recoverpe-grey-light bg-recoverpe-white"
                            : "border-recoverpe-grey-light bg-recoverpe-canvas"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm text-recoverpe-black">
                          {body}
                        </p>
                        <div className="mt-1.5 flex items-center justify-end gap-2 text-[11px] tabular-nums text-recoverpe-grey-medium">
                          <span>{formatTimestamp(entry.executed_at)}</span>
                          {!isInbound ? <DeliveryStatus entry={entry} /> : null}
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="mt-1 break-words text-sm text-recoverpe-grey-medium">
                          {entry.summary ?? entry.executive_summary ?? "Message sent"}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs tabular-nums text-recoverpe-grey-medium">
                          <span>{formatTimestamp(entry.executed_at)}</span>
                          {!isInbound ? <DeliveryStatus entry={entry} /> : null}
                        </div>
                      </>
                    )}

                    {entry.status === "failed" && entry.failure_reason ? (
                      <p className="mt-1.5 text-xs text-recoverpe-error">
                        {entry.failure_reason}
                      </p>
                    ) : null}
                    {entry.status === "read" && entry.read_at ? (
                      <p className="mt-1 text-xs text-recoverpe-grey-medium">
                        Seen {formatTimestamp(entry.read_at)}
                      </p>
                    ) : entry.status === "delivered" && entry.delivered_at ? (
                      <p className="mt-1 text-xs text-recoverpe-grey-medium">
                        Delivered {formatTimestamp(entry.delivered_at)}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
      </CardContent>
    </Card>
  );
}
