"use client";

import { FormEvent, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { fetchAdminOrders } from "@/lib/admin-client";
import { AdminRazorpayOrder } from "@/types";

function formatAmountPaise(amountPaise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amountPaise / 100);
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function statusClassName(status: AdminRazorpayOrder["status"]): string {
  switch (status) {
    case "paid":
      return "text-recoverpe-success";
    case "failed":
      return "text-recoverpe-error";
    default:
      return "text-recoverpe-black";
  }
}

export function AdminTransactionsView() {
  const [razorpayOrderId, setRazorpayOrderId] = useState("");
  const [userId, setUserId] = useState("");
  const [orders, setOrders] = useState<AdminRazorpayOrder[]>([]);
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await fetchAdminOrders({
        razorpayOrderId,
        userId,
      });
      setOrders(response.orders);
    } catch (searchError) {
      setOrders([]);
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Failed to search orders."
      );
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
          Operations
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-recoverpe-black">
          Transactions &amp; Support
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-recoverpe-grey-medium">
          Look up Razorpay checkout orders by order ID or user ID to verify
          payment status without opening the Razorpay dashboard.
        </p>
      </div>

      <Card>
        <CardContent>
          <form onSubmit={(event) => void handleSearch(event)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
                  Razorpay Order ID
                </label>
                <Input
                  placeholder="order_Nx..."
                  value={razorpayOrderId}
                  onChange={(event) => setRazorpayOrderId(event.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
                  User ID
                </label>
                <Input
                  placeholder="UUID"
                  value={userId}
                  onChange={(event) => setUserId(event.target.value)}
                />
              </div>
            </div>
            <Button type="submit" disabled={isSearching}>
              {isSearching ? "Searching..." : "Search Orders"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

      {hasSearched && !error ? (
        <Card>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <p className="p-4 text-sm text-recoverpe-grey-medium">
                No matching orders found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-recoverpe-grey-light bg-recoverpe-grey-light">
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-recoverpe-grey-medium">
                        Order ID
                      </th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-recoverpe-grey-medium">
                        User
                      </th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-recoverpe-grey-medium">
                        Purchase
                      </th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-recoverpe-grey-medium">
                        Amount
                      </th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-recoverpe-grey-medium">
                        Status
                      </th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-recoverpe-grey-medium">
                        Created
                      </th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-recoverpe-grey-medium">
                        Paid At
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-recoverpe-grey-light last:border-b-0"
                      >
                        <td className="px-4 py-3 align-top font-mono text-xs text-recoverpe-black">
                          {order.razorpay_order_id}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="font-mono text-xs text-recoverpe-black">
                            {order.user_id}
                          </p>
                          {order.user_email ? (
                            <p className="mt-1 text-xs text-recoverpe-grey-medium">
                              {order.user_email}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top text-recoverpe-black">
                          {order.purchase_type}
                          {order.ledger_id ? (
                            <p className="mt-1 font-mono text-xs text-recoverpe-grey-medium">
                              Ledger {order.ledger_id}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top tabular-nums text-recoverpe-black">
                          {formatAmountPaise(order.amount_paise)}
                        </td>
                        <td
                          className={`px-4 py-3 align-top text-sm font-medium capitalize ${statusClassName(order.status)}`}
                        >
                          {order.status}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-recoverpe-grey-medium">
                          {formatTimestamp(order.created_at)}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-recoverpe-grey-medium">
                          {formatTimestamp(order.paid_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
