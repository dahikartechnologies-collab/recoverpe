"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { createBusinessProfile } from "@/lib/businesses";
import { useWorkspaceStore } from "@/store/workspace-store";

export function AddBusinessModal() {
  const isOpen = useWorkspaceStore((state) => state.isBusinessModalOpen);
  const closeBusinessModal = useWorkspaceStore((state) => state.closeBusinessModal);
  const addBusiness = useWorkspaceStore((state) => state.addBusiness);

  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setBusinessName("");
    setError("");
  }

  function handleClose() {
    if (isSubmitting) {
      return;
    }

    resetForm();
    closeBusinessModal();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const business = await createBusinessProfile({
        business_name: businessName.trim(),
      });

      addBusiness(business);
      resetForm();
      closeBusinessModal();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create business profile."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add your business">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-recoverpe-grey-medium">
          Start collecting in under 30 seconds. Add GSTIN and address later when
          you need formal tax invoices or legal documents.
        </p>

        <div>
          <label
            htmlFor="businessName"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            Business name
          </label>
          <Input
            id="businessName"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            placeholder="Dahikar Technologies Pvt. Ltd."
            required
            autoFocus
          />
        </div>

        {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !businessName.trim()}>
            {isSubmitting ? "Creating..." : "Create workspace"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
