"use client";

import Image from "next/image";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { DashboardAnalyticsSection } from "@/components/dashboard/analytics/DashboardAnalyticsSection";
import { DashboardLedgersSection } from "@/components/dashboard/DashboardLedgersSection";
import { KhataOnboardQueue } from "@/components/dashboard/KhataOnboardQueue";
import { ShopQrDownloadButton } from "@/components/dashboard/ShopQrDownloadButton";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import DashboardLoading from "@/app/(dashboard)/loading";
import { useReconciliationActivity } from "@/hooks/use-reconciliation-activity";
import { useWorkspaceStore } from "@/store/workspace-store";

export function BusinessDashboardView() {
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const businesses = useWorkspaceStore((state) => state.businesses);
  const openBusinessModal = useWorkspaceStore((state) => state.openBusinessModal);
  const activeBusiness =
    businesses.find((business) => business.id === activeBusinessId) ?? null;
  const isWorkspacePermissionsReady = useWorkspaceStore(
    (state) => state.isWorkspacePermissionsReady
  );
  const { items, isLoading } = useReconciliationActivity(
    "business",
    activeBusiness?.id ?? null
  );

  if (!activeBusiness) {
    if (!isWorkspacePermissionsReady) {
      return <DashboardLoading />;
    }

    return (
      <Card>
        <CardContent className="py-8 text-center">
          <h1 className="text-2xl font-semibold text-recoverpe-black">
            Business Workspace
          </h1>
          <p className="mt-2 text-sm text-recoverpe-grey-medium">
            Add your business name to start collecting. GSTIN and address can wait
            until you need formal invoices.
          </p>
          <div className="mt-6">
            <Button onClick={openBusinessModal}>Add Business Profile</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="type-eyebrow">Active business profile</p>
          <h1 className="type-page-title mt-2">{activeBusiness.business_name}</h1>
          <p className="type-data-secondary mt-3 max-w-2xl text-sm leading-relaxed">
            {activeBusiness.gstin
              ? `GSTIN: ${activeBusiness.gstin} — Tax Invoice mode enabled.`
              : "Add GSTIN and address in Settings when you need tax invoices or legal docs."}
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
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
          <ShopQrDownloadButton
            businessId={activeBusiness.id}
            businessName={activeBusiness.business_name}
          />
        </div>
      </div>

      <ActivityFeed items={items} isLoading={isLoading} />

      <DashboardAnalyticsSection
        workspaceMode="business"
        businessId={activeBusiness.id}
      />

      <KhataOnboardQueue
        businessId={activeBusiness.id}
        businessName={activeBusiness.business_name}
      />

      <DashboardLedgersSection
        workspaceMode="business"
        businessId={activeBusiness.id}
      />
    </div>
  );
}
