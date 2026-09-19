import { RecoverpeLogo } from "@/components/brand/RecoverpeLogo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AgentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-recoverpe-canvas">
      <header className="border-b border-recoverpe-line bg-recoverpe-white px-6 py-4">
        <RecoverpeLogo size="sm" href="/agent-dashboard" />
      </header>
      {children}
    </div>
  );
}
