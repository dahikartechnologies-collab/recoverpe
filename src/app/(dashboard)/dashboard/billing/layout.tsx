import { ReactNode } from "react";
import { enforceOwnerWorkspaceRoute } from "@/lib/server/partner-route-guard";

export default function BillingLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  enforceOwnerWorkspaceRoute();

  return children;
}
