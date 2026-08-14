"use client";

import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FREE_PLAN_LEDGER_LIMIT } from "@/lib/razorpay-products";
import { useWorkspaceStore } from "@/store/workspace-store";

export function UpgradeToPremiumModal() {
  const router = useRouter();
  const isOpen = useWorkspaceStore((state) => state.isUpgradeModalOpen);
  const closeUpgradeModal = useWorkspaceStore((state) => state.closeUpgradeModal);
  const ledgerCount = useWorkspaceStore((state) => state.ledgerCount);

  function handleViewBilling() {
    closeUpgradeModal();
    router.push("/dashboard/billing");
  }

  return (
    <Modal isOpen={isOpen} onClose={closeUpgradeModal} title="Upgrade to Premium">
      <div className="space-y-4">
        <p className="text-sm text-recoverpe-grey-medium">
          You have reached the free plan limit of {FREE_PLAN_LEDGER_LIMIT} invoices
          {ledgerCount > 0 ? ` (${ledgerCount} created)` : ""}. Upgrade to Premium for
          unlimited entries, advanced automations, and priority recovery tools.
        </p>

        <div className="rounded-md border border-recoverpe-grey-light bg-recoverpe-grey-light px-4 py-3">
          <p className="text-sm font-medium text-recoverpe-black">Premium — ₹1,999</p>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            One-time upgrade. Unlimited invoices across Personal and Business modes.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={closeUpgradeModal}>
            Not now
          </Button>
          <Button type="button" onClick={handleViewBilling}>
            View billing
          </Button>
        </div>
      </div>
    </Modal>
  );
}
