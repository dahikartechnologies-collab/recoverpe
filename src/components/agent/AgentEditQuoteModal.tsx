"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { getAgentDiscountOptionsForCap } from "@/lib/agent/discounts";

interface AgentEditQuoteModalProps {
  isOpen: boolean;
  discountCapBps: number;
  businessName: string;
  discountBps: string;
  isSaving: boolean;
  onBusinessNameChange: (value: string) => void;
  onDiscountBpsChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function AgentEditQuoteModal({
  isOpen,
  discountCapBps,
  businessName,
  discountBps,
  isSaving,
  onBusinessNameChange,
  onDiscountBpsChange,
  onClose,
  onSave,
}: AgentEditQuoteModalProps) {
  const discountOptions = getAgentDiscountOptionsForCap(discountCapBps);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit merchant quote"
      disableClose={isSaving}
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="font-medium text-recoverpe-black">Shop name</span>
          <Input
            className="mt-1"
            value={businessName}
            onChange={(event) => onBusinessNameChange(event.target.value)}
            placeholder="Shop name"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-recoverpe-black">Discount</span>
          <Select
            className="mt-1"
            value={discountBps}
            onChange={(event) => onDiscountBpsChange(event.target.value)}
          >
            {discountOptions.map((option) => (
              <option key={option.bps} value={option.bps}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save quote"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
