"use client";

import { Badge, BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { AgentReferralRecord } from "@/lib/agent-client";
import {
  formatExpectedCashCollection,
  getAgentDiscountOptionsForCap,
  referralOnboardingStatus,
  referralStatusLabel,
} from "@/lib/agent/discounts";

const EDITABLE_REFERRAL_STATUSES = new Set(["draft", "awaiting_merchant_otp"]);

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
  discountCapBps: number;
  isEditing: boolean;
  editBusinessName: string;
  editDiscountBps: string;
  otpValue: string;
  isSaving: boolean;
  isConfirming: boolean;
  isResending: boolean;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditBusinessNameChange: (value: string) => void;
  onEditDiscountBpsChange: (value: string) => void;
  onOtpChange: (value: string) => void;
  onConfirmOtp: () => void;
  onResendOtp: () => void;
}

export function AgentLeadCard({
  referral,
  highlighted,
  cardRef,
  discountCapBps,
  isEditing,
  editBusinessName,
  editDiscountBps,
  otpValue,
  isSaving,
  isConfirming,
  isResending,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onEditBusinessNameChange,
  onEditDiscountBpsChange,
  onOtpChange,
  onConfirmOtp,
  onResendOtp,
}: AgentLeadCardProps) {
  const discountOptions = getAgentDiscountOptionsForCap(discountCapBps);
  const canEdit = EDITABLE_REFERRAL_STATUSES.has(referral.status);
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
            <div>
              <p className="text-base font-semibold tracking-tight text-recoverpe-black">
                {referral.business_name || "Unnamed merchant"}
              </p>
              <p className="mt-1 font-mono text-sm tabular-nums text-recoverpe-muted">
                {referral.merchant_phone}
              </p>
            </div>
            <div className="text-right">
              <Badge tone={onboardingTone(onboardingStatus)}>
                {onboardingStatus.replace(/_/g, " ")}
              </Badge>
              <p className="mt-2 text-xs text-recoverpe-muted">
                {referralStatusLabel(referral.status)}
              </p>
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
              <p className="type-eyebrow">Discount given</p>
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

          {isEditing ? (
            <div className="space-y-3 border-t border-recoverpe-line pt-4">
              <Input
                value={editBusinessName}
                onChange={(event) => onEditBusinessNameChange(event.target.value)}
                placeholder="Shop name"
              />
              <Select
                value={editDiscountBps}
                onChange={(event) => onEditDiscountBpsChange(event.target.value)}
              >
                {discountOptions.map((option) => (
                  <option key={option.bps} value={option.bps}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={isSaving}
                  onClick={onSaveEdit}
                >
                  {isSaving ? "Saving…" : "Save quote"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onCancelEdit}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 border-t border-recoverpe-line pt-4">
              {canEdit ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={onBeginEdit}
                >
                  Edit quote
                </Button>
              ) : null}
              {referral.status === "awaiting_merchant_otp" ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={isResending}
                    onClick={onResendOtp}
                  >
                    {isResending ? "Resending…" : "Resend OTP"}
                  </Button>
                  <Input
                    className="h-8 max-w-[132px] py-0 font-mono tracking-[0.2em]"
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
                </>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
