"use client";

import Image from "next/image";
import { DashboardLedgersSection } from "@/components/dashboard/DashboardLedgersSection";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { useWorkspaceStore } from "@/store/workspace-store";

export function BusinessDashboardView() {
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const businesses = useWorkspaceStore((state) => state.businesses);
  const openBusinessModal = useWorkspaceStore((state) => state.openBusinessModal);
  const activeBusiness =
    businesses.find((business) => business.id === activeBusinessId) ?? null;

  if (!activeBusiness) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <h1 className="text-2xl font-semibold text-recoverpe-black">
            Business Workspace
          </h1>
          <p className="mt-2 text-sm text-recoverpe-grey-medium">
            Select an existing business profile or create one to manage formal
            invoices, GST compliance, and B2B collections.
          </p>
          <div className="mt-6">
            <Button onClick={openBusinessModal}>Add Business Profile</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-recoverpe-grey-medium">
            Active business profile
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-recoverpe-black">
            {activeBusiness.business_name}
          </h1>
          <p className="mt-2 text-sm text-recoverpe-grey-medium">
            {activeBusiness.gstin
              ? `GSTIN: ${activeBusiness.gstin} — Tax Invoice mode enabled.`
              : "No GSTIN on file — Bill of Supply mode."}
          </p>
        </div>

        {activeBusiness.logo_url ? (
          <Image
            src={activeBusiness.logo_url}
            alt={`${activeBusiness.business_name} logo`}
            width={64}
            height={64}
            unoptimized
            className="h-16 w-16 rounded-md border border-recoverpe-grey-light object-contain"
          />
        ) : null}
      </div>

      <DashboardLedgersSection
        workspaceMode="business"
        businessId={activeBusiness.id}
      />
    </div>
  );
}
