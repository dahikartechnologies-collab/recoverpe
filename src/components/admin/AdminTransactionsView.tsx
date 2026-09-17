"use client";

import { FormEvent, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { fetchAdminOrders } from "@/lib/admin-client";
import { AdminRazorpayOrder } from "@/types";
import { Search } from "lucide-react";

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

function statusTone(status: AdminRazorpayOrder["status"]): BadgeTone {
  switch (status) {
    case "paid":
      return "success";
    case "failed":
      return "danger";
    default:
      return "warning";
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
      <PageHeader
        eyebrow="Operations"
        title="Transactions & Support"
        description="Look up Razorpay checkout orders by order ID or user ID to verify payment status without opening the Razorpay dashboard."
      />

      <Card>
        <CardContent>
          <form onSubmit={(event) => void handleSearch(event)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="type-eyebrow mb-1.5 block">
                  Razorpay Order ID
                </label>
                <Input
                  placeholder="order_Nx..."
                  value={razorpayOrderId}
                  onChange={(event) => setRazorpayOrderId(event.target.value)}
                />
              </div>
              <div>
                <label className="type-eyebrow mb-1.5 block">User ID</label>
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

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {hasSearched && !error ? (
        <Card>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <EmptyState
                icon={<Search className="h-5 w-5" aria-hidden />}
                title="No matching orders found"
                description="Try a different Razorpay order ID or user ID."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Order ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Purchase</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Paid At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono text-xs text-recoverpe-black">
                        {order.razorpay_order_id}
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-xs text-recoverpe-black">
                          {order.user_id}
                        </p>
                        {order.user_email ? (
                          <p className="type-data-secondary mt-1">
                            {order.user_email}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-recoverpe-black">
                        {order.purchase_type}
                        {order.ledger_id ? (
                          <p className="mt-1 font-mono text-xs text-recoverpe-muted">
                            Ledger {order.ledger_id}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="type-data-primary">
                        {formatAmountPaise(order.amount_paise)}
                      </TableCell>
                      <TableCell>
                        <Badge tone={statusTone(order.status)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-recoverpe-muted">
                        {formatTimestamp(order.created_at)}
                      </TableCell>
                      <TableCell className="text-xs text-recoverpe-muted">
                        {formatTimestamp(order.paid_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
