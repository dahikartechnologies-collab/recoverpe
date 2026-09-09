"use client";

import { AdminTransactionsView } from "@/components/admin/AdminTransactionsView";
import { useAdminPageGuard } from "@/hooks/use-admin-page-guard";

export default function AdminTransactionsPage() {
  const { isReady, error } = useAdminPageGuard(async () => {});

  if (!isReady && !error) {
    return (
      <p className="text-sm text-recoverpe-grey-medium">
        Loading transactions &amp; support...
      </p>
    );
  }

  if (error) {
    return <p className="text-sm text-recoverpe-error">{error}</p>;
  }

  return <AdminTransactionsView />;
}
