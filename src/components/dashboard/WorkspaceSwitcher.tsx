"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { fetchAccessibleWorkspaces } from "@/lib/workspace-client";
import {
  completeWorkspaceSwitch,
  getWorkspaceCookiesFromDocument,
  setWorkspaceCookies,
} from "@/lib/workspace-context";
import { useWorkspaceStore } from "@/store/workspace-store";
import { AccessibleBusinessOption } from "@/types";

interface WorkspaceSwitcherProps {
  compact?: boolean;
  kiosk?: boolean;
}

function resolveActiveOption(
  options: AccessibleBusinessOption[],
  cookies: ReturnType<typeof getWorkspaceCookiesFromDocument>
): AccessibleBusinessOption | null {
  if (options.length === 0) {
    return null;
  }

  const matched = options.find((option) => {
    if (cookies.workspaceUserId !== option.workspace_user_id) {
      return false;
    }

    if (option.is_own_workspace) {
      return true;
    }

    return Boolean(cookies.businessId) && option.business_id === cookies.businessId;
  });

  return (
    matched ??
    options.find((option) => option.is_own_workspace) ??
    options[0] ??
    null
  );
}

export function WorkspaceSwitcher({
  compact = false,
  kiosk = false,
}: WorkspaceSwitcherProps) {
  const storedOptions = useWorkspaceStore((state) => state.accessibleWorkspaces);
  const setAccessibleWorkspaces = useWorkspaceStore(
    (state) => state.setAccessibleWorkspaces
  );
  const [options, setOptions] = useState<AccessibleBusinessOption[]>(storedOptions);
  const [activeOption, setActiveOption] = useState<AccessibleBusinessOption | null>(
    null
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(storedOptions.length === 0);
  const containerRef = useRef<HTMLDivElement>(null);

  const ownOptions = useMemo(
    () => options.filter((option) => option.is_own_workspace),
    [options]
  );
  const assignedOptions = useMemo(
    () => options.filter((option) => !option.is_own_workspace),
    [options]
  );
  const switchableOptions = useMemo(
    () => (kiosk ? [...ownOptions, ...assignedOptions] : options),
    [assignedOptions, kiosk, options, ownOptions]
  );

  useEffect(() => {
    function applyOptions(next: AccessibleBusinessOption[]) {
      setOptions(next);
      const cookies = getWorkspaceCookiesFromDocument();
      const matched = resolveActiveOption(next, cookies);

      if (matched && !cookies.workspaceUserId) {
        setWorkspaceCookies(
          matched.workspace_user_id,
          matched.business_id || null
        );
      }

      setActiveOption(matched);
      setIsLoading(false);
    }

    if (storedOptions.length > 0) {
      applyOptions(storedOptions);
      return;
    }

    async function loadOptions() {
      setIsLoading(true);

      try {
        const response = await fetchAccessibleWorkspaces();
        setAccessibleWorkspaces(response.options);
        applyOptions(response.options);
      } catch {
        setOptions([]);
        setActiveOption(null);
        setIsLoading(false);
      }
    }

    void loadOptions();
  }, [storedOptions, setAccessibleWorkspaces]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  function handleSelect(option: AccessibleBusinessOption) {
    if (
      option.workspace_user_id === activeOption?.workspace_user_id &&
      option.is_own_workspace === activeOption.is_own_workspace &&
      option.business_id === activeOption.business_id
    ) {
      setIsOpen(false);
      return;
    }

    if (!option.is_own_workspace) {
      const confirmed = window.confirm(
        "You are entering partner access for this assigned role. Home, Settings, Billing, and business profile controls will be disabled. Continue?"
      );

      if (!confirmed) {
        return;
      }
    }

    setIsOpen(false);
    completeWorkspaceSwitch(
      option.workspace_user_id,
      option.business_id || null,
      option.role
    );
  }

  function renderOptionButton(option: AccessibleBusinessOption) {
    const isActive =
      option.workspace_user_id === activeOption?.workspace_user_id &&
      option.is_own_workspace === activeOption.is_own_workspace &&
      option.business_id === activeOption.business_id;

    return (
      <button
        key={`${option.workspace_user_id}-${option.is_own_workspace ? "own" : option.business_id}`}
        type="button"
        onClick={() => handleSelect(option)}
        className="focus-ring flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-all duration-200 ease-out hover:bg-recoverpe-grey-light/60"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-recoverpe-black">
            {option.context_label}
          </p>
          {!option.is_own_workspace ? (
            <p className="truncate text-[11px] text-recoverpe-grey-medium">
              Partner role · limited access · business settings disabled
            </p>
          ) : (
            <p className="truncate text-[11px] text-recoverpe-grey-medium">
              Your personal account and business profiles
            </p>
          )}
        </div>
        {isActive ? (
          <Check className="h-4 w-4 shrink-0 text-recoverpe-black" />
        ) : null}
      </button>
    );
  }

  if (isLoading) {
    if (kiosk) {
      return (
        <div className="h-10 animate-pulse rounded-lg bg-recoverpe-grey-light" />
      );
    }

    return (
      <div
        className={`rounded-lg border border-recoverpe-grey-light px-3 py-2.5 text-sm text-recoverpe-grey-medium ${
          compact ? "w-full" : ""
        }`}
      >
        Loading contexts...
      </div>
    );
  }

  if (switchableOptions.length === 0) {
    return null;
  }

  if (switchableOptions.length === 1) {
    return (
      <div className="truncate rounded-lg border border-recoverpe-grey-light px-3 py-2 text-xs font-semibold text-recoverpe-black">
        {switchableOptions[0]?.context_label || "Workspace"}
      </div>
    );
  }

  const activeLabel = activeOption?.context_label || "Select context";

  return (
    <div ref={containerRef} className={`relative ${compact || kiosk ? "w-full" : ""}`}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`focus-ring flex w-full items-center justify-between gap-2 rounded-lg border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2.5 text-left transition-all duration-200 ease-out hover:border-recoverpe-black ${
          kiosk ? "min-h-10 py-2" : compact ? "" : "min-w-[14rem]"
        }`}
      >
        <div className="min-w-0">
          <p
            className={`truncate font-semibold text-recoverpe-black ${
              kiosk ? "text-xs" : "text-sm"
            }`}
          >
            {activeLabel}
          </p>
          <p className="truncate text-[11px] text-recoverpe-grey-medium">
            {activeOption?.is_own_workspace ? "My Account" : "Assigned role"}
          </p>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-recoverpe-grey-medium" />
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-lg border border-recoverpe-grey-light bg-recoverpe-white py-1 shadow-none">
          {ownOptions.length > 0 ? (
            <div className="py-1">
              <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-recoverpe-grey-medium">
                My Account
              </p>
              {ownOptions.map((option) => renderOptionButton(option))}
            </div>
          ) : null}

          {assignedOptions.length > 0 ? (
            <div className="py-1">
              {ownOptions.length > 0 ? (
                <div className="my-1 border-t border-recoverpe-grey-light" />
              ) : null}
              <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-recoverpe-grey-medium">
                Partner access
              </p>
              {assignedOptions.map((option) => renderOptionButton(option))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
