import { Suspense } from "react";
import DashboardLoading from "@/app/(dashboard)/loading";
import { DashboardHomeClient } from "@/components/dashboard/DashboardHomeClient";
import { enforceDashboardHomeRoute } from "@/lib/server/partner-route-guard";

export const dynamic = "force-dynamic";

async function DashboardHomeContent() {
  await enforceDashboardHomeRoute();
  return <DashboardHomeClient />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardHomeContent />
    </Suspense>
  );
}
