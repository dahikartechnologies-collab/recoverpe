import { cookies } from "next/headers";
import { Suspense } from "react";
import { AuthLoadingScreen } from "@/components/auth/AuthLoadingScreen";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AUTH_SESSION_COOKIE } from "@/lib/cookie-constants";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hasSessionHint =
    cookies().get(AUTH_SESSION_COOKIE)?.value === "1";

  return (
    <Suspense fallback={<AuthLoadingScreen />}>
      <DashboardShell hasSessionHint={hasSessionHint}>{children}</DashboardShell>
    </Suspense>
  );
}
