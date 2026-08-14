"use client";

import { useWorkspaceStore } from "@/store/workspace-store";

export function WorkspaceToggle() {
  const mode = useWorkspaceStore((state) => state.mode);
  const setMode = useWorkspaceStore((state) => state.setMode);
  const businesses = useWorkspaceStore((state) => state.businesses);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const setActiveBusinessId = useWorkspaceStore((state) => state.setActiveBusinessId);
  const openBusinessModal = useWorkspaceStore((state) => state.openBusinessModal);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex rounded-md border border-recoverpe-grey-light p-1">
        <button
          type="button"
          onClick={() => setMode("personal")}
          className={`min-h-10 rounded px-4 py-2 text-sm font-medium transition-colors ${
            mode === "personal"
              ? "bg-recoverpe-black text-recoverpe-white"
              : "bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-grey-light"
          }`}
        >
          Personal
        </button>
        <button
          type="button"
          onClick={() => setMode("business")}
          className={`min-h-10 rounded px-4 py-2 text-sm font-medium transition-colors ${
            mode === "business"
              ? "bg-recoverpe-black text-recoverpe-white"
              : "bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-grey-light"
          }`}
        >
          Business
        </button>
      </div>

      {mode === "business" ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={activeBusinessId ?? ""}
            onChange={(event) =>
              setActiveBusinessId(event.target.value || null)
            }
            className="min-h-11 rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2 text-sm text-recoverpe-black outline-none focus:border-recoverpe-black"
          >
            <option value="" disabled>
              {businesses.length > 0
                ? "Select business profile"
                : "No business profiles yet"}
            </option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.business_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={openBusinessModal}
            className="min-h-11 rounded-md border border-recoverpe-black bg-recoverpe-white px-4 py-2 text-sm font-medium text-recoverpe-black transition-colors hover:bg-recoverpe-grey-light"
          >
            Add Business Profile
          </button>
        </div>
      ) : null}
    </div>
  );
}
