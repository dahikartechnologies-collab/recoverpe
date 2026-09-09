import { Suspense } from "react";
import { AuthLoadingScreen } from "@/components/auth/AuthLoadingScreen";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense fallback={<AuthLoadingScreen />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
