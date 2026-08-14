"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { manageAdminUser } from "@/lib/admin-client";
import {
  AdminManagedUser,
  AdminUserManageAction,
  SubscriptionPlan,
} from "@/types";

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

function statusClassName(status: AdminManagedUser["account_status"]): string {
  switch (status) {
    case "suspended":
      return "text-recoverpe-error";
    case "pending_purge":
      return "text-recoverpe-error";
    default:
      return "text-recoverpe-black";
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
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
          Recoverpe Control Room
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-recoverpe-black">
          User Management
        </h1>
        <p className="mt-2 text-sm text-recoverpe-grey-medium">
          Suspend accounts, grant upsell discounts, and prepare ghost-mode
          impersonation hooks.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-recoverpe-grey-light bg-recoverpe-grey-light">
                  <th className="px-4 py-3 font-medium text-recoverpe-black">Name</th>
                  <th className="px-4 py-3 font-medium text-recoverpe-black">Email</th>
                  <th className="px-4 py-3 font-medium text-recoverpe-black">Plan</th>
                  <th className="px-4 py-3 font-medium text-recoverpe-black">Status</th>
                  <th className="px-4 py-3 font-medium text-recoverpe-black">Discount</th>
                  <th className="px-4 py-3 font-medium text-recoverpe-black">
                    Registered
                  </th>
                  <th className="px-4 py-3 font-medium text-recoverpe-black">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isPending = pendingUserId === user.id;
                  const isSuspended = user.account_status === "suspended";

                  return (
                    <tr
                      key={user.id}
                      className="border-b border-recoverpe-grey-light last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-recoverpe-black">{user.name}</p>
                        {user.is_super_admin ? (
                          <p className="text-xs text-recoverpe-grey-medium">Super Admin</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-recoverpe-black">{user.email}</td>
                      <td className="px-4 py-3 text-recoverpe-black">
                        {planLabel(user.subscription_plan)}
                      </td>
                      <td
                        className={`px-4 py-3 capitalize ${statusClassName(user.account_status)}`}
                      >
                        {statusLabel(user.account_status)}
                      </td>
                      <td className="px-4 py-3 text-recoverpe-black">
                        {user.eligible_for_discount ? "50% eligible" : "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-recoverpe-grey-medium">
                        {formatRegisteredAt(user.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <details className="relative">
                          <summary className="cursor-pointer list-none rounded-md border border-recoverpe-grey-light px-3 py-2 text-sm font-medium text-recoverpe-black hover:bg-recoverpe-grey-light">
                            Actions
                          </summary>
                          <div className="absolute right-0 z-10 mt-2 min-w-[14rem] rounded-md border border-recoverpe-grey-light bg-recoverpe-white p-2 shadow-none">
                            {!isSuspended && !user.is_super_admin ? (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => void runAction(user.id, "suspend")}
                                className="block w-full rounded px-3 py-2 text-left text-sm text-recoverpe-black hover:bg-recoverpe-grey-light disabled:opacity-50"
                              >
                                Suspend User
                              </button>
                            ) : null}
                            {isSuspended ? (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => void runAction(user.id, "unsuspend")}
                                className="block w-full rounded px-3 py-2 text-left text-sm text-recoverpe-black hover:bg-recoverpe-grey-light disabled:opacity-50"
                              >
                                Unsuspend User
                              </button>
                            ) : null}
                            {!user.eligible_for_discount ? (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() =>
                                  void runAction(user.id, "grant_discount")
                                }
                                className="block w-full rounded px-3 py-2 text-left text-sm text-recoverpe-black hover:bg-recoverpe-grey-light disabled:opacity-50"
                              >
                                Grant 50% Upsell Discount
                              </button>
                            ) : null}
                            <Link
                              href={`/dashboard?impersonate=${user.id}`}
                              className="block rounded px-3 py-2 text-sm text-recoverpe-black hover:bg-recoverpe-grey-light"
                            >
                              View as Ghost
                            </Link>
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Link
        href="/admin"
        className="inline-block text-sm font-medium text-recoverpe-black underline underline-offset-4"
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
