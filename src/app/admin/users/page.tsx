"use client";

import { useCallback, useState } from "react";
import { AdminUsersView } from "@/components/admin/AdminUsersView";
import { fetchAdminUsers } from "@/lib/admin-client";
import { useAdminPageGuard } from "@/hooks/use-admin-page-guard";
import { AdminManagedUser } from "@/types";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminManagedUser[]>([]);

  const load = useCallback(async () => {
    const response = await fetchAdminUsers();
    setUsers(response.users);
  }, []);

  const { isReady, error } = useAdminPageGuard(load);

  if (!isReady && !error) {
    return (
      <p className="text-sm text-recoverpe-grey-medium">Loading user management...</p>
    );
  }

  if (error) {
    return <p className="text-sm text-recoverpe-error">{error}</p>;
  }

  return <AdminUsersView initialUsers={users} />;
}
