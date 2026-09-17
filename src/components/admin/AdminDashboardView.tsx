"use client";

import Link from "next/link";
import { AdminDiagnosticsPanel } from "@/components/admin/AdminDiagnosticsPanel";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { AdminMetricsResponse } from "@/types";
import { Users } from "lucide-react";

interface AdminDashboardViewProps {
  data: AdminMetricsResponse;
}

function formatRegisteredAt(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function AdminDashboardView({ data }: AdminDashboardViewProps) {
  const { metrics, recent_users } = data;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recoverpe Control Room"
        title="Super Admin"
        description="Global platform growth and system health overview."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Registered Users"
          description="Total accounts synced to Recoverpe."
          value={metrics.total_registered_users}
        />
        <AdminMetricCard
          label="Business Profiles"
          description="MSME business workspaces created."
          value={metrics.total_business_profiles}
        />
        <AdminMetricCard
          label="Premium Subscriptions"
          description="Users on the paid Premium plan."
          value={metrics.total_premium_subscriptions}
        />
        <AdminMetricCard
          label="Ledgers Created"
          description="Invoices and receivables system-wide."
          value={metrics.total_ledgers}
        />
      </div>

      <Card>
        <CardHeader>
          <p className="type-section-title">Recently Registered Users</p>
          <p className="mt-1 text-sm text-recoverpe-muted">
            Latest 10 accounts by signup date.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {recent_users.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" aria-hidden />}
              title="No users registered yet"
              description="New RecoverPe accounts will appear here as they sign up."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan Status</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent_users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-recoverpe-black">
                      {user.name}
                    </TableCell>
                    <TableCell className="text-recoverpe-black">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        tone={
                          user.subscription_plan === "premium"
                            ? "info"
                            : "neutral"
                        }
                      >
                        {user.subscription_plan === "premium"
                          ? "Premium"
                          : "Free"}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums text-recoverpe-muted">
                      {formatRegisteredAt(user.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AdminDiagnosticsPanel />

      <div className="flex flex-wrap gap-4">
        <Link
          href="/admin/users"
          className="rp-interactive text-sm font-medium text-recoverpe-black underline underline-offset-4"
        >
          Manage all users
        </Link>
        <Link
          href="/dashboard"
          className="rp-interactive text-sm font-medium text-recoverpe-black underline underline-offset-4"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
