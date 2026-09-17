import { DashboardHomeClient } from "@/components/dashboard/DashboardHomeClient";
import { enforceDashboardHomeRoute } from "@/lib/server/partner-route-guard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await enforceDashboardHomeRoute();

  return <DashboardHomeClient />;
}
