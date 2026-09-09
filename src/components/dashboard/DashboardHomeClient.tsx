"use client";

import { BusinessDashboardView } from "@/components/dashboard/BusinessDashboardView";
import { PersonalDashboardView } from "@/components/dashboard/PersonalDashboardView";
import { useWorkspaceStore } from "@/store/workspace-store";

export function DashboardHomeClient() {
  const mode = useWorkspaceStore((state) => state.mode);

  return mode === "business" ? <BusinessDashboardView /> : <PersonalDashboardView />;
}
