import { RecoverpeLogo } from "@/components/brand/RecoverpeLogo";

export default function AgentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-recoverpe-white">
      <header className="border-b border-recoverpe-grey-light px-6 py-4">
        <RecoverpeLogo size="sm" href="/agent-dashboard" />
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}
