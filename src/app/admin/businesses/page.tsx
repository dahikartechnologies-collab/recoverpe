"use client";

import { useCallback, useState } from "react";
import { AdminBusinessesView } from "@/components/admin/AdminBusinessesView";
import { fetchAdminBusinesses } from "@/lib/admin-client";
import { useAdminPageGuard } from "@/hooks/use-admin-page-guard";
import { AdminManagedBusiness } from "@/types";

export default function AdminBusinessesPage() {
  const [businesses, setBusinesses] = useState<AdminManagedBusiness[]>([]);

  const load = useCallback(async () => {
    const response = await fetchAdminBusinesses();
    setBusinesses(response.businesses);
  }, []);

  const { isReady, error } = useAdminPageGuard(load);

  if (!isReady && !error) {
    return (
      <p className="text-sm text-recoverpe-grey-medium">Loading business god mode...</p>
    );
  }

  if (error) {
    return <p className="text-sm text-recoverpe-error">{error}</p>;
  }

  return <AdminBusinessesView initialBusinesses={businesses} />;
}
