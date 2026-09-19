"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
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
import { Toast } from "@/components/ui/Toast";
import { manageAdminUser } from "@/lib/admin-client";
import {
  AdminManagedUser,
  AdminUserManageAction,
  SubscriptionPlan,
} from "@/types";
import { Users } from "lucide-react";

interface AdminUsersViewProps {
  initialUsers: AdminManagedUser[];
}

interface ToastState {
  message: string;
  variant: "success" | "error";
}

function formatRegisteredAt(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function planLabel(plan: SubscriptionPlan): string {
  return plan === "premium" ? "Premium" : "Free";
}

function statusLabel(status: AdminManagedUser["account_status"]): string {
  return status.replace(/_/g, " ");
}

function statusTone(status: AdminManagedUser["account_status"]): BadgeTone {
  switch (status) {
    case "suspended":
    case "pending_purge":
      return "danger";
    case "active":
      return "success";
    default:
      return "neutral";
  }
}

export function AdminUsersView({ initialUsers }: AdminUsersViewProps) {
  const [users, setUsers] = useState(initialUsers);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const runAction = useCallback(
    async (userId: string, action: AdminUserManageAction) => {
      setPendingUserId(userId);
      setToast(null);

      try {
        const result = await manageAdminUser({ user_id: userId, action });

        setUsers((current) =>
          current.map((user) => (user.id === userId ? result.user : user))
        );

        setToast({
          message: result.message,
          variant: "success",
        });
      } catch (error) {
        setToast({
          message:
            error instanceof Error ? error.message : "Admin action failed.",
          variant: "error",
        });
      } finally {
        setPendingUserId(null);
      }
    },
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Recoverpe Control Room"
        title="User Management"
        description="Suspend accounts, grant upsell discounts, and prepare ghost-mode impersonation hooks."
      />

      <Card>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" aria-hidden />}
              title="No users yet"
              description="Registered RecoverPe accounts will appear here for support actions."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const isPending = pendingUserId === user.id;
                  const isSuspended = user.account_status === "suspended";

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <p className="font-medium text-recoverpe-black">
                          {user.name}
                        </p>
                        {user.is_super_admin ? (
                          <Badge tone="info" className="mt-1">
                            Super Admin
                          </Badge>
                        ) : null}
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
                          {planLabel(user.subscription_plan)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge tone={statusTone(user.account_status)}>
                          {statusLabel(user.account_status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.eligible_for_discount ? (
                          <Badge tone="success">50% eligible</Badge>
                        ) : (
                          <span className="text-recoverpe-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums text-recoverpe-muted">
                        {formatRegisteredAt(user.created_at)}
                      </TableCell>
                      <TableCell>
                        <details className="relative">
                          <summary className="focus-ring rp-press inline-flex h-8 cursor-pointer list-none items-center justify-center rounded-md border border-recoverpe-line-strong bg-recoverpe-white px-3 text-xs font-medium text-recoverpe-black hover:bg-recoverpe-fill">
                            {isPending ? "Working..." : "Actions"}
                          </summary>
                          <div className="absolute right-0 z-10 mt-2 min-w-[14rem] rounded-xl border border-recoverpe-line bg-recoverpe-white p-1">
                            {!isSuspended && !user.is_super_admin ? (
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                disabled={isPending}
                                onClick={() => void runAction(user.id, "suspend")}
                                className="w-full justify-start"
                              >
                                Suspend User
                              </Button>
                            ) : null}
                            {isSuspended ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isPending}
                                onClick={() =>
                                  void runAction(user.id, "unsuspend")
                                }
                                className="w-full justify-start"
                              >
                                Unsuspend User
                              </Button>
                            ) : null}
                            {!user.eligible_for_discount ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isPending}
                                onClick={() =>
                                  void runAction(user.id, "grant_discount")
                                }
                                className="w-full justify-start"
                              >
                                Grant 50% Upsell Discount
                              </Button>
                            ) : null}
                            {!user.is_super_admin &&
                            user.account_status !== "pending_purge" ? (
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                disabled={isPending}
                                onClick={() => {
                                  const confirmed = window.confirm(
                                    "This will cancel active subscriptions and schedule permanent account deletion. Continue?"
                                  );

                                  if (confirmed) {
                                    void runAction(user.id, "schedule_deletion");
                                  }
                                }}
                                className="w-full justify-start"
                              >
                                Schedule Account Deletion
                              </Button>
                            ) : null}
                            <Link
                              href={`/dashboard?impersonate=${user.id}`}
                              className="rp-interactive flex h-8 items-center rounded-md px-3 text-xs font-medium text-recoverpe-grey-medium hover:bg-recoverpe-fill hover:text-recoverpe-black"
                            >
                              View as Ghost
                            </Link>
                          </div>
                        </details>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Link
        href="/admin"
        className="rp-interactive inline-block text-sm font-medium text-recoverpe-black underline underline-offset-4"
      >
        Back to overview
      </Link>

      {toast ? (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
