"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Crown,
  IndianRupee,
  Percent,
  QrCode,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { AdminDiagnosticsPanel } from "@/components/admin/AdminDiagnosticsPanel";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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

interface AdminDashboardViewProps {
  data: AdminMetricsResponse;
}

function formatCurrencyInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatRegisteredAt(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

interface SupremacyMetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  accentClassName?: string;
  valueClassName?: string;
}

function SupremacyMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentClassName = "border-recoverpe-line bg-recoverpe-canvas text-recoverpe-black",
  valueClassName = "text-recoverpe-black",
}: SupremacyMetricCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-none pb-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-xs text-recoverpe-muted">{subtitle}</p>
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${accentClassName}`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <p className={`text-3xl font-semibold tracking-tight tabular-nums ${valueClassName}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export function AdminDashboardView({ data }: AdminDashboardViewProps) {
  const { metrics, recent_users } = data;
  const recoveryHealthy = metrics.platform_recovery_rate_percent > 50;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Recoverpe Control Room"
        title="Admin Supremacy"
        description="Live SaaS revenue, collection engine health, and merchant tier distribution."
      />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-recoverpe-black" aria-hidden />
          <h2 className="type-section-title">Revenue Engine</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SupremacyMetricCard
            title="MRR"
            subtitle="Monthly recurring revenue · Business ₹999 + Premium ₹1,999"
            value={formatCurrencyInr(metrics.mrr_inr)}
            icon={IndianRupee}
            accentClassName="border-recoverpe-black bg-recoverpe-black text-recoverpe-white"
          />
          <SupremacyMetricCard
            title="ARR"
            subtitle="Annualized run rate (MRR × 12)"
            value={formatCurrencyInr(metrics.arr_inr)}
            icon={TrendingUp}
            accentClassName="border-recoverpe-black bg-recoverpe-black text-recoverpe-white"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-recoverpe-black" aria-hidden />
          <h2 className="type-section-title">Collection Health</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <SupremacyMetricCard
            title="Debt Under Recovery"
            subtitle="Open ledger balances awaiting collection"
            value={formatCurrencyInr(metrics.total_debt_under_recovery_inr)}
            icon={Wallet}
          />
          <SupremacyMetricCard
            title="Smart Collect Collected"
            subtitle="Reconciled Smart Collect volume platform-wide"
            value={formatCurrencyInr(metrics.total_smart_collect_collected_inr)}
            icon={IndianRupee}
            accentClassName="border-recoverpe-success-line bg-recoverpe-success-fill text-recoverpe-success-ink"
          />
          <SupremacyMetricCard
            title="Platform Recovery Rate"
            subtitle="Collected ÷ total open debt"
            value={`${metrics.platform_recovery_rate_percent.toFixed(1)}%`}
            icon={Percent}
            accentClassName={
              recoveryHealthy
                ? "border-recoverpe-success-line bg-recoverpe-success-fill text-recoverpe-success-ink"
                : "border-recoverpe-warning-line bg-recoverpe-warning-fill text-recoverpe-warning-ink"
            }
            valueClassName={
              recoveryHealthy
                ? "text-recoverpe-success-ink"
                : "text-recoverpe-warning-ink"
            }
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-recoverpe-black" aria-hidden />
          <h2 className="type-section-title">SaaS Distribution</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SupremacyMetricCard
            title="Starter"
            subtitle="Free / entry workspaces"
            value={formatCount(metrics.tier_starter_count)}
            icon={Users}
          />
          <SupremacyMetricCard
            title="Business"
            subtitle="₹999/mo Smart Collect tier"
            value={formatCount(metrics.tier_business_count)}
            icon={Building2}
          />
          <SupremacyMetricCard
            title="Premium"
            subtitle="₹1,999/mo Command Center tier"
            value={formatCount(metrics.tier_premium_count)}
            icon={Crown}
          />
          <SupremacyMetricCard
            title="Active Khata Merchants"
            subtitle="Khata QR auto-approve or onboarding queue"
            value={formatCount(metrics.active_khata_merchants)}
            icon={QrCode}
            accentClassName="border-recoverpe-line bg-recoverpe-canvas text-recoverpe-black"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="type-section-title">Platform Scale</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SupremacyMetricCard
            title="Registered Users"
            subtitle="Accounts synced to RecoverPe"
            value={formatCount(metrics.total_registered_users)}
            icon={Users}
          />
          <SupremacyMetricCard
            title="Business Profiles"
            subtitle="MSME workspaces created"
            value={formatCount(metrics.total_business_profiles)}
            icon={Building2}
          />
          <SupremacyMetricCard
            title="Premium Users"
            subtitle="User-level Premium subscriptions"
            value={formatCount(metrics.total_premium_subscriptions)}
            icon={Crown}
          />
          <SupremacyMetricCard
            title="Ledgers Created"
            subtitle="Invoices and receivables system-wide"
            value={formatCount(metrics.total_ledgers)}
            icon={TrendingUp}
          />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recently Registered Users</CardTitle>
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
          href="/admin/agents"
          className="rp-interactive text-sm font-medium text-recoverpe-black underline underline-offset-4"
        >
          Field agent dossier
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
