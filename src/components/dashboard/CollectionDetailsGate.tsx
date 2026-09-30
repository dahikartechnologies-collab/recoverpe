"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { COLLECTION_DETAILS_REQUIRED_MESSAGE } from "@/lib/collection-details";
import { useWorkspaceStore } from "@/store/workspace-store";

export function CollectionDetailsGate() {
  const router = useRouter();
  const isOpen = useWorkspaceStore((state) => state.isCollectionGateOpen);
  const closeCollectionGate = useWorkspaceStore(
    (state) => state.closeCollectionGate
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeCollectionGate}
      title="Add collection details first"
    >
      <div className="space-y-4">
        <p className="text-sm text-recoverpe-grey-medium">
          {COLLECTION_DETAILS_REQUIRED_MESSAGE}
        </p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={closeCollectionGate}>
            Not now
          </Button>
          <Button
            type="button"
            onClick={() => {
              closeCollectionGate();
              router.push("/dashboard/settings");
            }}
          >
            Open Settings
          </Button>
        </div>
      </div>
    </Modal>
  );
}
