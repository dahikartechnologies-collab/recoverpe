"use client";

import { useEffect, useState } from "react";
import { PremiumUpgradeLock } from "@/components/billing/PremiumUpgradeLock";
import { Card, CardContent } from "@/components/ui/Card";
import { getAuthHeaders } from "@/lib/auth-headers";
import { DailyBriefing } from "@/lib/briefing-types";
import { parseApiJsonResponse } from "@/lib/parse-api-response";
import { useActiveBusinessEntitlements } from "@/lib/use-active-business-entitlement";
import { useWorkspaceStore } from "@/store/workspace-store";

export function MorningBriefingCard() {
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const { hasEntitlement } = useActiveBusinessEntitlements();
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);

  const canViewBriefing = hasEntitlement("morning_briefing");

  useEffect(() => {
    if (!activeBusinessId || !canViewBriefing) {
      setBriefing(null);
      return;
    }

    void (async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(
          `/api/briefings/today?business_id=${encodeURIComponent(activeBusinessId)}`,
          { headers }
        );
        const body = await parseApiJsonResponse<{ briefing: DailyBriefing | null }>(
          response
        );
        setBriefing(body.briefing);
      } catch {
        setBriefing(null);
      }
    })();
  }, [activeBusinessId, canViewBriefing]);

  if (!canViewBriefing) {
    return (
      <PremiumUpgradeLock
        title="Morning Briefing"
        description="Premium unlocks the daily Command Center briefing with overnight collections, broken promises, and recovery priorities."
      />
    );
  }

  if (!briefing) {
    return (
      <Card>
        <CardContent className="p-5">
          <p className="type-eyebrow">Morning briefing</p>
          <h3 className="mt-1 text-base font-semibold text-recoverpe-black">
            Yesterday&apos;s work
          </h3>
          <p className="mt-3 text-sm text-recoverpe-grey-medium">
            The 10:00 IST cron writes this card after overnight UPI and Meta
            webhooks land.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5">
        <p className="type-eyebrow">Morning briefing</p>
        <h3 className="mt-1 text-base font-semibold text-recoverpe-black">
          {briefing.headline}
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-recoverpe-grey-medium">
          {briefing.bullets.map((bullet) => (
            <li key={bullet.label}>
              <span className="font-medium text-recoverpe-black">
                {bullet.label}.
              </span>{" "}
              {bullet.detail}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
