"use client";

import Link from "next/link";
import { RecoverpeLogo } from "@/components/brand/RecoverpeLogo";
import { Button } from "@/components/ui/Button";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-recoverpe-grey-light bg-recoverpe-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <RecoverpeLogo size="sm" href="/" priority />
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-sm font-medium text-recoverpe-black transition-colors hover:bg-recoverpe-grey-light"
          >
            Login
          </Link>
          <Link href="/register">
            <Button className="min-h-10 px-4 py-2">Get Started</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
