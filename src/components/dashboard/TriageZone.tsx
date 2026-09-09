"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/gst";
import {
  HostileCallAlert,
  PendingVerificationAlert,
} from "@/lib/dashboard-intelligence-client";

interface TriageZoneProps {
  hostileCalls: HostileCallAlert[];
  pendingVerifications: PendingVerificationAlert[];
  isLoading?: boolean;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function TriageZoneSkeleton() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 2 }).map((_, index) => (
        <li
          key={index}
          className="rounded-md border border-recoverpe-grey-light px-5 py-4"
        >
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-3 h-3 w-64" />
          <Skeleton className="mt-3 h-3 w-full max-w-md" />
        </li>
      ))}
    </ul>
  );
}

export function TriageZone({
  hostileCalls,
  pendingVerifications,
  isLoading = false,
}: TriageZoneProps) {
  const totalAlerts = hostileCalls.length + pendingVerifications.length;

  return (
    <Card>
      <CardContent className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-recoverpe-black">
            Triage
          </h2>
          <p className="type-data-secondary mt-2 text-sm">
            Urgent actions requiring your attention.
          </p>
        </div>

        {isLoading ? (
          <TriageZoneSkeleton />
        ) : totalAlerts === 0 ? (
          <p className="type-data-secondary text-sm">
            No urgent alerts. Your queue is clear.
          </p>
        ) : (
          <ul className="space-y-3">
            {hostileCalls.map((alert) => (
              <li
                key={alert.communication_log_id}
                className="rounded-md border border-recoverpe-grey-light px-5 py-4 transition-all duration-200 ease-out hover:bg-recoverpe-grey-light/40"
              >
                <div className="flex items-start gap-3">
                  <span aria-hidden="true">🔴</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-recoverpe-black">
                      Hostile AI call — {alert.contact_name}
                    </p>
                    <p className="type-data-secondary mt-1.5">
                      <span className="type-data-primary text-sm">
                        {formatCurrency(alert.balance_due)}
                      </span>{" "}
                      outstanding · {formatTimestamp(alert.executed_at)}
                    </p>
                    {alert.executive_summary ? (
                      <p className="mt-3 text-sm leading-relaxed text-recoverpe-black">
                        {alert.executive_summary}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}

            {pendingVerifications.map((alert) => (
              <li
                key={alert.verification_id}
                className="rounded-md border border-recoverpe-grey-light px-5 py-4 transition-all duration-200 ease-out hover:bg-recoverpe-grey-light/40"
              >
                <div className="flex items-start gap-3">
                  <span aria-hidden="true">🟡</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-recoverpe-black">
                      Pending payment verification — {alert.contact_name}
                    </p>
                    <p className="type-data-secondary mt-1.5">
                      {alert.claimed_amount != null ? (
                        <>
                          Claimed{" "}
                          <span className="type-data-primary text-sm">
                            {formatCurrency(alert.claimed_amount)}
                          </span>{" "}
                          ·{" "}
                        </>
                      ) : null}
                      Balance{" "}
                      <span className="type-data-primary text-sm">
                        {formatCurrency(alert.balance_due)}
                      </span>{" "}
                      · {formatTimestamp(alert.submitted_at)}
                    </p>
                    <a
                      href={alert.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring mt-3 inline-block rounded-sm text-sm font-medium text-recoverpe-black underline underline-offset-2 transition-all duration-200 ease-out hover:text-recoverpe-grey-medium"
                    >
                      View payment screenshot
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
