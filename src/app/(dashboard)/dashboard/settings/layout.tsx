import { ReactNode } from "react";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { enforceSettingsRoute } from "@/lib/server/partner-route-guard";

export default async function SettingsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await enforceSettingsRoute();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <SettingsNav />
      {children}
    </div>
  );
}
