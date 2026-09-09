"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface IdentitySupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fieldLabel: "Email" | "Primary Phone Number";
}

export function IdentitySupportModal({
  isOpen,
  onClose,
  fieldLabel,
}: IdentitySupportModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Update ${fieldLabel}`}>
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-recoverpe-grey-medium">
          For security reasons, changing your primary verified identity requires a
          support ticket. Please contact{" "}
          <a
            href="mailto:admin@recoverpe.com"
            className="font-medium text-recoverpe-black underline underline-offset-2"
          >
            admin@recoverpe.com
          </a>{" "}
          to process this change.
        </p>
        <p className="text-xs text-recoverpe-grey-medium">
          Our team will verify your ownership before updating your {fieldLabel.toLowerCase()}{" "}
          on file.
        </p>
        <div className="flex justify-end pt-2">
          <Button type="button" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </Modal>
  );
}
