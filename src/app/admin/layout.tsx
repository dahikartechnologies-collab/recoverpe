import { ReactNode } from "react";
import { AdminNav } from "@/components/admin/AdminNav";

export default function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-recoverpe-white">
      <header className="border-b border-recoverpe-grey-light px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <p className="text-sm font-semibold text-recoverpe-black">Recoverpe Admin</p>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
