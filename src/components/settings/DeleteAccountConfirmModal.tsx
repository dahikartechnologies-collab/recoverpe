"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

const DELETE_CONFIRMATION_TEXT = "DELETE";

interface DeleteAccountConfirmModalProps {
  isOpen: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAccountConfirmModal({
  isOpen,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteAccountConfirmModalProps) {
  const [confirmation, setConfirmation] = useState("");

  function handleClose() {
    if (isDeleting) {
      return;
    }

    setConfirmation("");
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (confirmation.trim() !== DELETE_CONFIRMATION_TEXT) {
      return;
    }

    onConfirm();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Delete account permanently"
      disableClose={isDeleting}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm leading-relaxed text-recoverpe-muted">
          Deleting your account will immediately terminate your subscription and
          recurring mandates. As per our Terms of Service, remaining billing
          periods are non-refundable. Your data will be scheduled for permanent
          erasure under DPDP guidelines.
        </p>

        <label className="block text-sm">
          <span className="font-medium text-recoverpe-black">
            Type {DELETE_CONFIRMATION_TEXT} to confirm
          </span>
          <Input
            className="mt-1 font-mono uppercase"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={DELETE_CONFIRMATION_TEXT}
            disabled={isDeleting}
            autoComplete="off"
          />
        </label>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={
              isDeleting || confirmation.trim() !== DELETE_CONFIRMATION_TEXT
            }
          >
            {isDeleting ? "Processing…" : "Delete My Account & Data"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
