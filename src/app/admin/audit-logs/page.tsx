"use client";

import { useCallback, useState } from "react";
import {
  AdminAuditLogsView,
  type AdminAuditLogRecord,
} from "@/components/admin/AdminAuditLogsView";
import { fetchAdminAuditLogs } from "@/lib/admin-client";
import { useAdminPageGuard } from "@/hooks/use-admin-page-guard";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AdminAuditLogRecord[]>([]);

  const load = useCallback(async () => {
    const response = await fetchAdminAuditLogs();
    setLogs(response.logs);
  }, []);

  const { isReady, error } = useAdminPageGuard(load);

  if (error) {
    return <p className="text-sm text-recoverpe-error">{error}</p>;
  }

  return <AdminAuditLogsView logs={logs} isLoading={!isReady} />;
}
