import { Suspense, ReactNode } from "react";
import { KioskAuthLoadingScreen } from "@/components/auth/AuthLoadingScreen";
import { KioskShell } from "@/components/kiosk/KioskShell";

export default function KioskLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <Suspense fallback={<KioskAuthLoadingScreen />}>
      <KioskShell>{children}</KioskShell>
    </Suspense>
  );
}
