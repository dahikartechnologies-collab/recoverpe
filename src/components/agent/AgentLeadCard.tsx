"use client";

import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { AgentReferralRecord } from "@/lib/agent-client";
import {
  formatExpectedCashCollection,
  getAgentDiscountOptionsForCap,
  referralOnboardingStatus,
  referralStatusLabel,
} from "@/lib/agent/discounts";

const selectClassName =
  "w-full rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2 text-sm text-recoverpe-black";

const EDITABLE_REFERRAL_STATUSES = new Set(["draft", "awaiting_merchant_otp"]);

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
      className={highlighted ? "rounded-xl ring-1 ring-recoverpe-black" : undefined}
    >
      <Card
        className={
          highlighted ? "border-recoverpe-black" : undefined
        }
      >
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-recoverpe-black">
              {referral.business_name || "Unnamed merchant"}
            </p>
            <p className="mt-1 text-sm text-recoverpe-grey-medium">
              {referral.merchant_phone}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-flex rounded-full border border-recoverpe-grey-light px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-recoverpe-black">
              {onboardingStatus}
            </span>
            <p className="mt-2 text-xs text-recoverpe-grey-medium">
              {referralStatusLabel(referral.status)}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-recoverpe-grey-light px-3 py-2">
            <p className="text-xs text-recoverpe-grey-medium">Quoted price</p>
            <p className="mt-1 font-semibold text-recoverpe-black">
              {formatExpectedCashCollection(referral.discount_bps)}
            </p>
          </div>
          <div className="rounded-md border border-recoverpe-grey-light px-3 py-2">
            <p className="text-xs text-recoverpe-grey-medium">Discount given</p>
            <p className="mt-1 font-semibold text-recoverpe-black">
              {referral.discount_bps / 100}%
            </p>
          </div>
          <div className="rounded-md border border-recoverpe-grey-light px-3 py-2">
            <p className="text-xs text-recoverpe-grey-medium">Created</p>
            <p className="mt-1 text-sm text-recoverpe-black">
              {new Intl.DateTimeFormat("en-IN", {
                day: "numeric",
                month: "short",
              }).format(new Date(referral.created_at))}
            </p>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-3 border-t border-recoverpe-grey-light pt-4">
            <Input
              value={editBusinessName}
              onChange={(event) => onEditBusinessNameChange(event.target.value)}
              placeholder="Shop name"
            />
            <select
              className={selectClassName}
              value={editDiscountBps}
              onChange={(event) => onEditDiscountBpsChange(event.target.value)}
            >
              {discountOptions.map((option) => (
                <option key={option.bps} value={option.bps}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isSaving}
                onClick={onSaveEdit}
              >
                {isSaving ? "Saving…" : "Save quote"}
              </Button>
              <Button type="button" variant="secondary" onClick={onCancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 border-t border-recoverpe-grey-light pt-4">
            {canEdit ? (
              <Button type="button" variant="secondary" onClick={onBeginEdit}>
                Edit quote
              </Button>
            ) : null}
            {referral.status === "awaiting_merchant_otp" ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isResending}
                  onClick={onResendOtp}
                >
                  {isResending ? "Resending…" : "Resend OTP"}
                </Button>
                <Input
                  className="max-w-[140px]"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="OTP"
                  value={otpValue}
                  onChange={(event) =>
                    onOtpChange(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                />
                <Button
                  type="button"
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
