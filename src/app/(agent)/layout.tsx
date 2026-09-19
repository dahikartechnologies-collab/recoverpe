import { RecoverpeLogo } from "@/components/brand/RecoverpeLogo";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AgentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-recoverpe-canvas">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-recoverpe-line bg-recoverpe-white px-6 py-4">
        <RecoverpeLogo size="sm" href="/agent-dashboard" />
        <Badge tone="success" className="text-xs sm:text-[11px]">
          TIER-1 V2.0 ACTIVE
        </Badge>
      </header>
      {children}
    </div>
  );
}
