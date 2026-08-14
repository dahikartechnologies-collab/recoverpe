"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { AdminDashboardView } from "@/components/admin/AdminDashboardView";
import { AdminAccessDeniedError, fetchAdminMetrics } from "@/lib/admin-client";
import { getFirebaseAuth } from "@/lib/firebase";
import { AdminMetricsResponse } from "@/types";

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminMetricsResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const metrics = await fetchAdminMetrics();
        setData(metrics);
      } catch (loadError) {
        if (loadError instanceof AdminAccessDeniedError) {
          router.replace("/dashboard");
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load admin dashboard."
        );
        setData(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return (
      <p className="text-sm text-recoverpe-grey-medium">Loading admin dashboard...</p>
    );
  }

  if (error || !data) {
    return <p className="text-sm text-recoverpe-error">{error || "Unable to load admin data."}</p>;
  }

  return <AdminDashboardView data={data} />;
}
