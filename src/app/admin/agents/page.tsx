"use client";

import { useCallback, useState } from "react";
import { AdminAgentsView } from "@/components/admin/AdminAgentsView";
import { fetchAdminAgents } from "@/lib/admin-client";
import { useAdminPageGuard } from "@/hooks/use-admin-page-guard";
import { AdminAgentRecord } from "@/types";

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<AdminAgentRecord[]>([]);

  const load = useCallback(async () => {
    const response = await fetchAdminAgents();
    setAgents(response.agents);
  }, []);

  const { isReady, error } = useAdminPageGuard(load);

  if (!isReady && !error) {
    return (
      <p className="text-sm text-recoverpe-grey-medium">Loading agent management...</p>
    );
  }

  if (error) {
    return <p className="text-sm text-recoverpe-error">{error}</p>;
  }

  return <AdminAgentsView initialAgents={agents} />;
}
