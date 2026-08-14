import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense
      fallback={
        <p className="px-4 py-6 text-sm text-recoverpe-grey-medium">
          Loading dashboard...
        </p>
      }
    >
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
