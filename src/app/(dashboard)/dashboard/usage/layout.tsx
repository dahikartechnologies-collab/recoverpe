import { enforceOwnerWorkspaceRoute } from "@/lib/server/partner-route-guard";

export default function UsageLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  enforceOwnerWorkspaceRoute();

  return children;
}
