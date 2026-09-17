"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/auth";
import { clearAppRoleCookie } from "@/lib/auth-cookies";
import { clearWorkspaceCookies } from "@/lib/workspace-context";

interface DashboardLogoutButtonProps {
  variant?: "sidebar" | "mobile" | "header";
}

export function DashboardLogoutButton({
  variant = "sidebar",
}: DashboardLogoutButtonProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);

    try {
      clearAppRoleCookie();
      clearWorkspaceCookies();
      await logout();
      router.replace("/login");
    } catch {
      setIsLoggingOut(false);
    }
  }

  if (variant === "header") {
    return (
      <button
        type="button"
        onClick={() => void handleLogout()}
        disabled={isLoggingOut}
        className="rp-interactive rp-press inline-flex h-10 items-center gap-2 rounded-md border border-recoverpe-line-strong bg-recoverpe-white px-3 text-sm font-medium text-recoverpe-black hover:bg-recoverpe-fill disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" />
        {isLoggingOut ? "Logging out..." : "Log Out"}
      </button>
    );
  }

  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={() => void handleLogout()}
        disabled={isLoggingOut}
        className="flex w-full items-center justify-center gap-2 border-b border-recoverpe-grey-light px-4 py-3 text-sm font-semibold text-recoverpe-black disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" />
        {isLoggingOut ? "Logging out..." : "Log Out"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={isLoggingOut}
      className="flex w-full items-center gap-3 rounded-md border border-recoverpe-black px-3 py-3 text-sm font-semibold text-recoverpe-black disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" />
      {isLoggingOut ? "Logging out..." : "Log Out"}
    </button>
  );
}
