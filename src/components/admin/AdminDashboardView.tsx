"use client";

import Link from "next/link";
import { AdminMetricCard } from "@/components/admin/AdminMetricCard";
import { Card, CardContent } from "@/components/ui/Card";
import { AdminMetricsResponse } from "@/types";

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

function planLabel(plan: string): string {
  return plan === "premium" ? "Premium" : "Free";
}

export function AdminDashboardView({ data }: AdminDashboardViewProps) {
  const { metrics, recent_users } = data;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
          Recoverpe Control Room
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-recoverpe-black">
          Super Admin
        </h1>
        <p className="mt-2 text-sm text-recoverpe-grey-medium">
          Global platform growth and system health overview.
        </p>
      </div>

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
        <CardContent className="p-0">
          <div className="border-b border-recoverpe-grey-light px-4 py-3">
            <p className="text-sm font-medium text-recoverpe-black">
              Recently Registered Users
            </p>
            <p className="mt-1 text-sm text-recoverpe-grey-medium">
              Latest 10 accounts by signup date.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-recoverpe-grey-light bg-recoverpe-grey-light">
                  <th className="px-4 py-3 font-medium text-recoverpe-black">Name</th>
                  <th className="px-4 py-3 font-medium text-recoverpe-black">Email</th>
                  <th className="px-4 py-3 font-medium text-recoverpe-black">
                    Plan Status
                  </th>
                  <th className="px-4 py-3 font-medium text-recoverpe-black">
                    Registered
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent_users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-sm text-recoverpe-grey-medium"
                    >
                      No users registered yet.
                    </td>
                  </tr>
                ) : (
                  recent_users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-recoverpe-grey-light last:border-b-0"
                    >
                      <td className="px-4 py-3 font-medium text-recoverpe-black">
                        {user.name}
                      </td>
                      <td className="px-4 py-3 text-recoverpe-black">{user.email}</td>
                      <td className="px-4 py-3 text-recoverpe-black">
                        {planLabel(user.subscription_plan)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-recoverpe-grey-medium">
                        {formatRegisteredAt(user.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div>
        <Link
          href="/admin/users"
          className="inline-block text-sm font-medium text-recoverpe-black underline underline-offset-4"
        >
          Manage all users
        </Link>
      </div>

      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-recoverpe-black underline underline-offset-4"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
