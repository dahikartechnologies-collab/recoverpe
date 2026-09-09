"use client";

import { motion } from "framer-motion";
import { Sparkles, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/gst";
import { ReconciliationActivityItem } from "@/lib/dashboard-activity-feed";

interface ActivityFeedProps {
  items: ReconciliationActivityItem[];
  isLoading?: boolean;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatInvoiceCount(count: number): string {
  if (count === 1) {
    return "1 oldest invoice automatically marked as PAID.";
  }

  return `${count} oldest invoices automatically marked as PAID.`;
}

function ActivityFeedSkeleton() {
  return (
    <ul className="space-y-0">
      {Array.from({ length: 3 }).map((_, index) => (
        <li
          key={index}
          className="relative border-l border-recoverpe-grey-light pl-6 pb-6 last:pb-0"
        >
          <Skeleton className="absolute -left-1.5 top-1 h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-3 w-full max-w-lg" />
          <Skeleton className="mt-2 h-3 w-28" />
        </li>
      ))}
    </ul>
  );
}

function ActivityFeedItem({ item, index }: { item: ReconciliationActivityItem; index: number }) {
  const isAdvance = item.activity_type === "wallet_advance";

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, delay: index * 0.06, ease: "easeOut" }}
      className="relative border-l border-recoverpe-grey-light pl-6 pb-6 last:pb-0"
    >
      <span
        className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-recoverpe-white bg-recoverpe-success shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
        aria-hidden
      />
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-recoverpe-grey-medium">
        {formatTimestamp(item.processed_at)}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-recoverpe-black">
        {isAdvance ? (
          <>
            <span className="font-semibold text-recoverpe-success">
              Advance received:
            </span>{" "}
            <span className="font-semibold text-recoverpe-success">
              {formatCurrency(item.amount)}
            </span>{" "}
            logged for{" "}
            <span className="font-medium text-recoverpe-black">
              {item.vendor_name}
            </span>
            .{" "}
            <span className="text-recoverpe-grey-medium">
              Khata wallet credited and WhatsApp receipt sent.
            </span>
          </>
        ) : (
          <>
            <span className="font-semibold text-recoverpe-success">
              Magic Reconciled:
            </span>{" "}
            <span className="font-semibold text-recoverpe-success">
              {formatCurrency(item.amount)}
            </span>{" "}
            received from{" "}
            <span className="font-medium text-recoverpe-black">
              {item.vendor_name}
            </span>
            .{" "}
            {item.invoices_paid_count > 0 ? (
              <span className="text-recoverpe-success">
                {formatInvoiceCount(item.invoices_paid_count)}
              </span>
            ) : (
              <span className="text-recoverpe-grey-medium">
                Payment credited to vendor wallet.
              </span>
            )}
          </>
        )}
      </p>
    </motion.li>
  );
}

export function ActivityFeed({ items, isLoading = false }: ActivityFeedProps) {
  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="type-eyebrow">Collections</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-recoverpe-black">
              Activity feed
            </h2>
            <p className="type-data-secondary mt-2 text-sm">
              Smart Collect matches and manual Jama advances appear here in real
              time.
            </p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <div className="rounded-md border border-recoverpe-success/30 bg-recoverpe-success/5 p-2">
              <Sparkles className="h-4 w-4 text-recoverpe-success" aria-hidden />
            </div>
            <div className="rounded-md border border-recoverpe-success/30 bg-recoverpe-success/5 p-2">
              <Wallet className="h-4 w-4 text-recoverpe-success" aria-hidden />
            </div>
          </div>
        </div>

        {isLoading ? (
          <ActivityFeedSkeleton />
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed border-recoverpe-grey-light px-5 py-8 text-center">
            <p className="text-sm font-medium text-recoverpe-black">
              No collection activity yet
            </p>
            <p className="type-data-secondary mt-2 text-sm">
              When you log a Jama advance or Smart Collect matches an inbound
              transfer, the audit trail will appear here immediately.
            </p>
          </div>
        ) : (
          <ol className="space-y-0">
            {items.map((item, index) => (
              <ActivityFeedItem key={item.id} item={item} index={index} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
