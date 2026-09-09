"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/gst";
import { WallOfShameEntry } from "@/lib/dashboard-intelligence-client";

interface WallOfShameWidgetProps {
  entries: WallOfShameEntry[];
  isLoading?: boolean;
  onEscalate: (entry: WallOfShameEntry) => void;
}

function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function WallOfShameSkeleton() {
  return (
    <ul className="divide-y divide-recoverpe-grey-light rounded-md border border-recoverpe-grey-light">
      {Array.from({ length: 4 }).map((_, index) => (
        <li key={index} className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-56" />
          </div>
          <Skeleton className="h-9 w-20 shrink-0 rounded-md" />
        </li>
      ))}
    </ul>
  );
}

export function WallOfShameWidget({
  entries,
  isLoading = false,
  onEscalate,
}: WallOfShameWidgetProps) {
  return (
    <Card>
      <CardContent className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-recoverpe-black">
            Wall of Shame
          </h2>
          <p className="type-data-secondary mt-2 text-sm">
            Top debtors by balance and days overdue.
          </p>
        </div>

        {isLoading ? (
          <WallOfShameSkeleton />
        ) : entries.length === 0 ? (
          <p className="type-data-secondary text-sm">
            No overdue accounts in this workspace.
          </p>
        ) : (
          <ul className="divide-y divide-recoverpe-grey-light rounded-md border border-recoverpe-grey-light">
            {entries.map((entry, index) => (
              <li
                key={entry.ledger_id}
                className="group flex items-center justify-between gap-4 px-5 py-4 transition-all duration-200 ease-out hover:bg-recoverpe-grey-light/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-recoverpe-black">
                    {index + 1}. {entry.contact_name}
                  </p>
                  <p className="type-data-secondary mt-1.5">
                    <span className="type-data-primary text-sm">
                      {formatCurrency(entry.balance_due)}
                    </span>{" "}
                    · Due {formatDueDate(entry.due_date)} · {entry.days_overdue}d overdue
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 text-xs opacity-100 transition-all duration-200 ease-out md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                  onClick={() => onEscalate(entry)}
                >
                  Escalate
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
