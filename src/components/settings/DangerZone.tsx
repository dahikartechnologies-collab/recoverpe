"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { deleteBusinessProfile, fetchBusinesses } from "@/lib/businesses";
import { useWorkspaceStore } from "@/store/workspace-store";

export function DangerZone() {
  const router = useRouter();
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const businesses = useWorkspaceStore((state) => state.businesses);
  const setBusinesses = useWorkspaceStore((state) => state.setBusinesses);
  const business =
    businesses.find((entry) => entry.id === activeBusinessId) ?? businesses[0] ?? null;

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDeleteBusiness() {
    if (!business) {
      return;
    }

    setIsDeleting(true);
    setError("");

    try {
      await deleteBusinessProfile(business.id);
      const nextBusinesses = await fetchBusinesses();
      setBusinesses(nextBusinesses);
      setIsDeleteOpen(false);
      router.replace("/dashboard/settings");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete business."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  if (!business) {
    return null;
  }

  return (
    <>
      <Card className="border-recoverpe-error/30">
        <CardHeader>
          <h2 className="text-lg font-semibold text-recoverpe-black">Danger zone</h2>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Irreversible actions restricted to the workspace owner.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsDeleteOpen(true)}
            disabled={isDeleting}
          >
            Delete business
          </Button>
        </CardContent>
      </Card>

      <Modal
        isOpen={isDeleteOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteOpen(false);
          }
        }}
        title="Delete business"
        disableClose={isDeleting}
      >
        <div className="space-y-4">
          <p className="text-sm text-recoverpe-grey-medium">
            Permanently delete{" "}
            <span className="font-medium text-recoverpe-black">
              {business.business_name}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleDeleteBusiness()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete business"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
