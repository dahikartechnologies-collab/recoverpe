import { ReactNode } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { enforceAdminRouteAccess } from "@/lib/server/admin-route-guard";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await enforceAdminRouteAccess();

  return (
    <div className="min-h-screen bg-recoverpe-canvas">
      <header className="border-b border-recoverpe-line bg-recoverpe-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <p className="text-sm font-semibold text-recoverpe-black">Recoverpe Admin</p>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
