"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-recoverpe-white">
      <div className="border-b border-recoverpe-grey-light px-6 py-5 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Skeleton className="h-6 w-28" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-11 w-28" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 sm:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
        <Skeleton className="mt-8 h-64 w-full rounded-lg" />
      </div>

      <p className="sr-only">Authenticating...</p>
    </div>
  );
}

export function KioskAuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-recoverpe-white px-4 py-6">
      <div className="mx-auto max-w-lg space-y-4">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
      <p className="sr-only">Authenticating...</p>
    </div>
  );
}
