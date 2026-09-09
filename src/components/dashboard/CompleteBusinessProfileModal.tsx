"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface CompleteBusinessProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CompleteBusinessProfileModal({
  isOpen,
  onClose,
}: CompleteBusinessProfileModalProps) {
  const router = useRouter();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Complete your business profile">
      <div className="space-y-4">
        <p className="text-sm text-recoverpe-grey-medium">
          Please complete your Business Profile (GSTIN, Address) to generate formal
          legal documents.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Not now
          </Button>
          <Button
            type="button"
            onClick={() => {
              onClose();
              router.push("/dashboard/settings/profile");
            }}
          >
            Complete profile
          </Button>
        </div>
      </div>
    </Modal>
  );
}
