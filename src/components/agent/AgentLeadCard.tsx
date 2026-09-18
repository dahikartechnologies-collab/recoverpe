"use client";

import { Badge, BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { AgentLeadActionsMenu } from "@/components/agent/AgentLeadActionsMenu";
import type { AgentReferralRecord } from "@/lib/agent-client";
import {
  formatExpectedCashCollection,
  referralOnboardingStatus,
  referralStatusLabel,
} from "@/lib/agent/discounts";

function onboardingTone(status: string): BadgeTone {
  switch (status) {
    case "active":
      return "success";
    case "awaiting_otp":
      return "warning";
    case "cancelled":
    case "clawback":
      return "danger";
    default:
      return "neutral";
  }
}

interface AgentLeadCardProps {
  referral: AgentReferralRecord;
  highlighted: boolean;
  cardRef?: (node: HTMLDivElement | null) => void;
  agentName: string;
  referralCode: string;
  otpValue: string;
  isConfirming: boolean;
  isResending: boolean;
  onOtpChange: (value: string) => void;
  onConfirmOtp: () => void;
  onResendOtp: () => void;
  onEditQuote: () => void;
  onCancelReferral: () => void;
}

export function AgentLeadCard({
  referral,
  highlighted,
  cardRef,
  agentName,
  referralCode,
  otpValue,
  isConfirming,
  isResending,
  onOtpChange,
  onConfirmOtp,
  onResendOtp,
  onEditQuote,
  onCancelReferral,
}: AgentLeadCardProps) {
  const onboardingStatus = referralOnboardingStatus(referral.status);

  return (
    <div
      id={`referral-${referral.id}`}
      ref={cardRef}
      className={
        highlighted
          ? "rounded-xl ring-1 ring-recoverpe-black transition-shadow duration-150"
          : undefined
      }
    >
      <Card className={highlighted ? "border-recoverpe-black" : undefined}>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold tracking-tight text-recoverpe-black">
                {referral.business_name || "Unnamed merchant"}
              </p>
              <p className="mt-1 font-mono text-sm tabular-nums text-recoverpe-muted">
                {referral.merchant_phone}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <div className="text-right">
                <Badge tone={onboardingTone(onboardingStatus)}>
                  {onboardingStatus.replace(/_/g, " ")}
                </Badge>
                <p className="mt-2 text-xs text-recoverpe-muted">
                  {referralStatusLabel(referral.status)}
                </p>
              </div>
              <AgentLeadActionsMenu
                referral={referral}
                agentName={agentName}
                referralCode={referralCode}
                isResending={isResending}
                onResendOtp={onResendOtp}
                onEditQuote={onEditQuote}
                onCancelReferral={onCancelReferral}
              />
            </div>
          </div>

          <div className="grid divide-y divide-recoverpe-line overflow-hidden rounded-xl border border-recoverpe-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <div className="px-3 py-2.5">
              <p className="type-eyebrow">Quoted price</p>
              <p className="mt-1 type-data-primary">
                {formatExpectedCashCollection(referral.discount_bps)}
              </p>
            </div>
            <div className="px-3 py-2.5">
              <p className="type-eyebrow">Discount applied</p>
              <p className="mt-1 type-data-primary">
                {referral.discount_bps / 100}%
              </p>
            </div>
            <div className="px-3 py-2.5">
              <p className="type-eyebrow">Created</p>
              <p className="mt-1 text-sm text-recoverpe-black">
                {new Intl.DateTimeFormat("en-IN", {
                  day: "numeric",
                  month: "short",
                }).format(new Date(referral.created_at))}
              </p>
            </div>
          </div>

          {referral.status === "awaiting_merchant_otp" ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-recoverpe-line pt-4">
              <Input
                className="h-10 max-w-[140px] py-0 font-mono tracking-[0.2em]"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="••••••"
                value={otpValue}
                onChange={(event) =>
                  onOtpChange(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
              <Button
                type="button"
                size="sm"
                disabled={isConfirming}
                onClick={onConfirmOtp}
              >
                {isConfirming ? "Confirming…" : "Confirm OTP"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
