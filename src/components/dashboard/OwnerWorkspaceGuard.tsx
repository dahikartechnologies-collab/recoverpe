"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/workspace-store";

interface PermissionWorkspaceGuardProps {
  children: ReactNode;
  canAccess: boolean;
  redirectTo?: string;
}

export function PermissionWorkspaceGuard({
  children,
  canAccess,
  redirectTo = "/dashboard/vendors",
}: PermissionWorkspaceGuardProps) {
  const router = useRouter();

  useEffect(() => {
    if (!canAccess) {
      router.replace(redirectTo);
    }
  }, [canAccess, redirectTo, router]);

  if (!canAccess) {
    return null;
  }

  return <>{children}</>;
}

/** @deprecated Use PermissionWorkspaceGuard with explicit permission checks. */
export function OwnerWorkspaceGuard({
  children,
  redirectTo = "/dashboard/vendors",
}: {
  children: ReactNode;
  redirectTo?: string;
}) {
  const isOwnWorkspaceContext = useWorkspaceStore(
    (state) => state.isOwnWorkspaceContext
  );
  const workspaceRole = useWorkspaceStore((state) => state.workspaceRole);

  return (
    <PermissionWorkspaceGuard
      canAccess={isOwnWorkspaceContext || workspaceRole === "owner"}
      redirectTo={redirectTo}
    >
      {children}
    </PermissionWorkspaceGuard>
  );
}
