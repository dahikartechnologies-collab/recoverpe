import { ReactNode } from "react";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-recoverpe-canvas">
      <header className="border-b border-recoverpe-line bg-recoverpe-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div>
            <p className="type-eyebrow">Recoverpe Control Room</p>
            <p className="mt-1 text-sm font-semibold text-recoverpe-black">
              Admin Console
            </p>
          </div>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
