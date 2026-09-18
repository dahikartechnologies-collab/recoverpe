"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

const CANCEL_REASONS = [
  { value: "wrong_number", label: "Wrong number" },
  { value: "merchant_declined", label: "Merchant declined" },
  { value: "duplicate", label: "Duplicate" },
] as const;

interface AgentCancelReferralModalProps {
  isOpen: boolean;
  reason: string;
  isSaving: boolean;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function AgentCancelReferralModal({
  isOpen,
  reason,
  isSaving,
  onReasonChange,
  onClose,
  onConfirm,
}: AgentCancelReferralModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancel referral"
      disableClose={isSaving}
    >
      <div className="space-y-4">
        <p className="text-sm text-recoverpe-muted">
          Tell us why this referral should be dropped. The lead moves to a cancelled
          state and cannot be reactivated.
        </p>

        <label className="block text-sm">
          <span className="font-medium text-recoverpe-black">Reason</span>
          <Select
            className="mt-1"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
          >
            <option value="">Select a reason</option>
            {CANCEL_REASONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Keep referral
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            disabled={isSaving || !reason}
          >
            {isSaving ? "Cancelling…" : "Cancel referral"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
