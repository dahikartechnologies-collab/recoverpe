"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { getPremiumAmountLabel } from "@/lib/razorpay-products";

interface RecoveryUpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  recoveredAmountLabel: string;
  eligibleForDiscount: boolean;
}

export function RecoveryUpsellModal({
  isOpen,
  onClose,
  recoveredAmountLabel,
  eligibleForDiscount,
}: RecoveryUpsellModalProps) {
  const router = useRouter();
  const discountedPrice = getPremiumAmountLabel(true);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Recovery Milestone Unlocked">
      <div className="space-y-4">
        <p className="text-sm text-recoverpe-grey-medium">
          You have recovered{" "}
          <span className="font-semibold text-recoverpe-black">
            {recoveredAmountLabel}
          </span>{" "}
          through Recoverpe. That is a serious collections win.
        </p>
        <div className="rounded-md border border-recoverpe-grey-light px-4 py-3">
          <p className="text-sm font-medium text-recoverpe-black">
            Upgrade to Premium with 50% off your first month
          </p>
          <p className="mt-1 text-2xl font-semibold text-recoverpe-black">
            {discountedPrice}
            <span className="ml-2 text-sm font-normal text-recoverpe-grey-medium line-through">
              ₹1,999
            </span>
          </p>
          {eligibleForDiscount ? (
            <p className="mt-2 text-xs text-recoverpe-success">
              Your account is now eligible for the recovery discount.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Maybe later
          </Button>
          <Button
            type="button"
            onClick={() => {
              onClose();
              router.push("/dashboard/billing");
            }}
          >
            Claim 50% Off
          </Button>
        </div>
      </div>
    </Modal>
  );
}
