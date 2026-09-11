"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  Mail,
  MessageSquare,
  Phone,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { getAuthHeaders } from "@/lib/auth-headers";
import { CommunicationChannel, CommunicationLog, CommunicationStatus } from "@/types";

interface CommunicationHistoryProps {
  contactId: string;
}

const CHANNEL_ICON: Record<CommunicationChannel, typeof MessageSquare> = {
  whatsapp: MessageSquare,
  sms: MessageSquare,
  email: Mail,
  voice: Phone,
};

const CHANNEL_LABEL: Record<CommunicationChannel, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Email",
  voice: "Voice call",
};

const STATUS_LABEL: Record<CommunicationStatus, string> = {
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
  call_completed: "Completed",
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

function DeliveryStatus({ status }: { status: CommunicationStatus }) {
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-recoverpe-error">
        <AlertCircle className="h-3.5 w-3.5" />
        {STATUS_LABEL.failed}
      </span>
    );
  }

  if (status === "read") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-recoverpe-success">
        <CheckCheck className="h-3.5 w-3.5" />
        {STATUS_LABEL.read}
      </span>
    );
  }

  if (status === "delivered") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-recoverpe-grey-medium">
        <CheckCheck className="h-3.5 w-3.5" />
        {STATUS_LABEL.delivered}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-recoverpe-grey-medium">
      <Check className="h-3.5 w-3.5" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function CommunicationHistory({ contactId }: CommunicationHistoryProps) {
  const [entries, setEntries] = useState<CommunicationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `/api/vendors/${contactId}/communications`,
        { headers }
      );
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
    }
  }, [contactId]);

  useEffect(() => {
    void loadHistory();
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

  if (error) {
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
        <CardContent className="p-5">
          <p className="text-sm text-recoverpe-grey-medium">
            No messages have been exchanged with this contact yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-recoverpe-grey-light">
          {entries.map((entry) => {
            const ChannelIcon = CHANNEL_ICON[entry.channel] ?? MessageSquare;
            const isInbound = entry.direction === "inbound";
            const DirectionIcon = isInbound ? ArrowDownLeft : ArrowUpRight;

            return (
              <li key={entry.id} className="flex gap-3 px-5 py-4">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-recoverpe-grey-light">
                  <ChannelIcon className="h-4 w-4 text-recoverpe-black" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <DirectionIcon className="h-3.5 w-3.5 text-recoverpe-grey-medium" />
                    <span className="text-sm font-medium text-recoverpe-black">
                      {isInbound ? "Received" : "Sent"} &middot;{" "}
                      {CHANNEL_LABEL[entry.channel] ?? entry.channel}
                    </span>
                    {!isInbound ? <DeliveryStatus status={entry.status} /> : null}
                  </div>
                  <p className="mt-1 break-words text-sm text-recoverpe-grey-medium">
                    {entry.summary ?? entry.executive_summary ?? "Message sent"}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-recoverpe-grey-medium">
                    {formatTimestamp(entry.executed_at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
