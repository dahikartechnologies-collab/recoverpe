import Link from "next/link";
import { ReactNode } from "react";
import { RecoverpeLogo } from "@/components/brand/RecoverpeLogo";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

interface LegalPageLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

export function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-recoverpe-white">
      <header className="border-b border-recoverpe-grey-light">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <RecoverpeLogo size="sm" href="/" />
          <Link
            href="/"
            className="text-sm font-medium text-recoverpe-grey-medium transition-colors hover:text-recoverpe-black"
          >
            Back to Home
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-recoverpe-black sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-recoverpe-grey-medium">
          Last updated: {lastUpdated}
        </p>
        <article className="prose-legal mt-10 space-y-6 text-sm leading-7 text-recoverpe-black sm:text-base">
          {children}
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
