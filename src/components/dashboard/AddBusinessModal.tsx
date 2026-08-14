"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { createBusinessProfile } from "@/lib/businesses";
import { getFirebaseAuth } from "@/lib/firebase";
import { uploadBusinessLogo } from "@/lib/storage";
import { useWorkspaceStore } from "@/store/workspace-store";

export function AddBusinessModal() {
  const isOpen = useWorkspaceStore((state) => state.isBusinessModalOpen);
  const closeBusinessModal = useWorkspaceStore((state) => state.closeBusinessModal);
  const addBusiness = useWorkspaceStore((state) => state.addBusiness);

  const [businessName, setBusinessName] = useState("");
  const [gstin, setGstin] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setBusinessName("");
    setGstin("");
    setLogoFile(null);
    setError("");
  }

  function handleClose() {
    if (isSubmitting) {
      return;
    }

    resetForm();
    closeBusinessModal();
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setLogoFile(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const authUser = getFirebaseAuth().currentUser;

      if (!authUser) {
        throw new Error("You must be signed in to add a business profile.");
      }

      let logoUrl: string | null = null;

      if (logoFile) {
        logoUrl = await uploadBusinessLogo(logoFile, authUser.uid);
      }

      const business = await createBusinessProfile({
        business_name: businessName.trim(),
        gstin: gstin.trim() || null,
        logo_url: logoUrl,
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Business Profile">
      <form className="space-y-4" onSubmit={handleSubmit}>
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
            placeholder="Dahikar Technologies Pvt Ltd"
            required
          />
        </div>

        <div>
          <label
            htmlFor="gstin"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            GSTIN (optional)
          </label>
          <Input
            id="gstin"
            value={gstin}
            onChange={(event) => setGstin(event.target.value.toUpperCase())}
            placeholder="22AAAAA0000A1Z5"
          />
        </div>

        <div>
          <label
            htmlFor="logo"
            className="mb-1.5 block text-sm font-medium text-recoverpe-black"
          >
            Logo (optional)
          </label>
          <Input
            id="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleLogoChange}
            className="py-2"
          />
          <p className="mt-1.5 text-xs text-recoverpe-grey-medium">
            Uploaded to Firebase Storage at public/logos/
          </p>
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
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save business profile"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
