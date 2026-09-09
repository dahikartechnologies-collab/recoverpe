"use client";

import { useWorkspaceStore } from "@/store/workspace-store";

export function WorkspaceToggle() {
  const mode = useWorkspaceStore((state) => state.mode);
  const setMode = useWorkspaceStore((state) => state.setMode);
  const businesses = useWorkspaceStore((state) => state.businesses);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const setActiveBusinessId = useWorkspaceStore((state) => state.setActiveBusinessId);
  const openBusinessModal = useWorkspaceStore((state) => state.openBusinessModal);
  const isOwnWorkspaceContext = useWorkspaceStore(
    (state) => state.isOwnWorkspaceContext
  );
  const activeBusiness =
    businesses.find((business) => business.id === activeBusinessId) ?? null;

  if (!isOwnWorkspaceContext) {
    return (
      <div className="rounded-lg border border-recoverpe-grey-light px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-recoverpe-grey-medium">
          Partner access
        </p>
        <p className="mt-1 text-sm font-semibold text-recoverpe-black">
          {activeBusiness?.business_name || "Scoped business view"}
        </p>
        <p className="mt-1 text-xs text-recoverpe-grey-medium">
          Partner-assigned role only. Home, Settings, and business profile controls
          are disabled. Switch to My Account for your own workspace.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex rounded-md border border-recoverpe-grey-light p-1">
        <button
          type="button"
          onClick={() => setMode("personal")}
          className={`focus-ring min-h-10 rounded px-4 py-2 text-sm font-medium transition-all duration-200 ease-out ${
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
          className={`focus-ring min-h-10 rounded px-4 py-2 text-sm font-medium transition-all duration-200 ease-out ${
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
            className="focus-ring min-h-11 rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2 text-sm text-recoverpe-black transition-all duration-200 ease-out"
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
            className="focus-ring min-h-11 rounded-md border border-recoverpe-black bg-recoverpe-white px-4 py-2 text-sm font-medium text-recoverpe-black transition-all duration-200 ease-out hover:bg-recoverpe-grey-light"
          >
            Add Business Profile
          </button>
        </div>
      ) : null}
    </div>
  );
}
