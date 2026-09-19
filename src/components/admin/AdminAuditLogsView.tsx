"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Shield } from "lucide-react";

export interface AdminAuditLogRecord {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor?: {
    email?: string;
    full_name?: string | null;
  } | null;
}

interface AdminAuditLogsViewProps {
  logs: AdminAuditLogRecord[];
  isLoading?: boolean;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function actorLabel(log: AdminAuditLogRecord): string {
  const actor = log.actor;

  if (actor?.full_name?.trim()) {
    return actor.full_name;
  }

  if (actor?.email?.trim()) {
    return actor.email;
  }

  return "System";
}

export function AdminAuditLogsView({ logs, isLoading = false }: AdminAuditLogsViewProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Security"
        title="Audit logs"
        description="Append-only trail of privileged mutations across quotes, referrals, invites, and KYC."
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon={<Shield className="h-5 w-5" aria-hidden />}
              title="No audit events yet"
              description="Mutations such as quote edits, referral cancellations, and team invites appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-recoverpe-black">
                        {formatTimestamp(log.created_at)}
                      </TableCell>
                      <TableCell className="text-recoverpe-black">
                        {actorLabel(log)}
                      </TableCell>
                      <TableCell>
                        <Badge tone="neutral">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-recoverpe-muted">
                        {log.resource_type}
                        {log.resource_id ? ` · ${log.resource_id.slice(0, 8)}` : ""}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-recoverpe-muted">
                        {log.metadata ? JSON.stringify(log.metadata) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
