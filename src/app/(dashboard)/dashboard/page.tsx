"use client";

import { BusinessDashboardView } from "@/components/dashboard/BusinessDashboardView";
import { PersonalDashboardView } from "@/components/dashboard/PersonalDashboardView";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function DashboardPage() {
  const mode = useWorkspaceStore((state) => state.mode);

  if (mode === "business") {
    return <BusinessDashboardView />;
  }

  return <PersonalDashboardView />;
}
