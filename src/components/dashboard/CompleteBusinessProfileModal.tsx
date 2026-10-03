"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { GstExemptionCheckbox } from "@/components/settings/GstExemptionCheckbox";
import { fetchBusinesses, updateBusinessSettings } from "@/lib/businesses";
import { useWorkspaceStore } from "@/store/workspace-store";

interface CompleteBusinessProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CompleteBusinessProfileModal({
  isOpen,
  onClose,
}: CompleteBusinessProfileModalProps) {
  const router = useRouter();
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const setBusinesses = useWorkspaceStore((state) => state.setBusinesses);
  const [gstNotRequired, setGstNotRequired] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setGstNotRequired(false);
      setError("");
    }
  }, [isOpen]);

  async function handleSaveExemption() {
    if (!activeBusinessId) {
      setError("Select a business profile first.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      await updateBusinessSettings(activeBusinessId, {
        gst_not_required: true,
        gstin: null,
      });
      const businesses = await fetchBusinesses();
      setBusinesses(businesses);
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save GST preference."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="GST registration">
      <div className="space-y-4">
        <p className="text-sm text-recoverpe-grey-medium">
          GSTIN is optional. RecoverPe works for shops that are not registered for GST.
          Formal legal notices still need you to confirm GST status below.
        </p>
        <GstExemptionCheckbox
          checked={gstNotRequired}
          onChange={setGstNotRequired}
          disabled={isSaving}
        />
        {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Not now
          </Button>
          {gstNotRequired ? (
            <Button
              type="button"
              onClick={() => void handleSaveExemption()}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save and continue"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                onClose();
                router.push("/dashboard/settings/profile");
              }}
            >
              Add GSTIN
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
