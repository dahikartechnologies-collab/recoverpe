"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { AdminDiagnosticsPanel } from "@/components/admin/AdminDiagnosticsPanel";
import { AdminOmnichannelDiagnosticsCard } from "@/components/admin/AdminOmnichannelDiagnosticsCard";
import { AdminAccessDeniedError, fetchAdminMetrics } from "@/lib/admin-client";
import { getFirebaseAuth } from "@/lib/firebase";

export default function AdminDiagnosticsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setIsLoading(true);

      try {
        await fetchAdminMetrics();
        setIsAuthorized(true);
      } catch (error) {
        if (error instanceof AdminAccessDeniedError) {
          router.replace("/dashboard");
          return;
        }

        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return (
      <p className="text-sm text-recoverpe-grey-medium">Loading diagnostics...</p>
    );
  }

  if (!isAuthorized) {
    return (
      <p className="text-sm text-recoverpe-error">
        You do not have access to admin diagnostics.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-recoverpe-black">Diagnostics</h1>
        <p className="mt-1 text-sm text-recoverpe-grey-medium">
          Integration health checks and omnichannel test dispatchers for RecoverPe
          operations.
        </p>
      </div>

      <AdminOmnichannelDiagnosticsCard />
      <AdminDiagnosticsPanel />
    </div>
  );
}
