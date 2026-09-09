import { DashboardHomeClient } from "@/components/dashboard/DashboardHomeClient";
import { enforceDashboardHomeRoute } from "@/lib/server/partner-route-guard";

export default async function DashboardPage() {
  await enforceDashboardHomeRoute();

  return <DashboardHomeClient />;
}
