"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { getFirebaseAuth, logout } from "@/lib/auth";

export default function AccountPendingPurgePage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
      if (!user) {
        router.replace("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function handleSignOut() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-lg">
        <CardContent className="py-8 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-recoverpe-error">
            Access restricted
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-recoverpe-black">
            Account Scheduled for Deletion
          </h1>
          <p className="mt-3 text-sm text-recoverpe-grey-medium">
            Your Recoverpe account and associated data have been scheduled for
            deletion per DPDP compliance. Dashboard access is disabled while
            the purge is pending.
          </p>
          <p className="mt-2 text-sm text-recoverpe-grey-medium">
            To cancel this request, contact{" "}
            <a
              href="mailto:admin@recoverpe.com"
              className="font-medium text-recoverpe-black underline underline-offset-2"
            >
              admin@recoverpe.com
            </a>{" "}
            before the purge completes.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button type="button" onClick={() => void handleSignOut()}>
              Sign out
            </Button>
            <Link
              href="mailto:admin@recoverpe.com"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-recoverpe-black bg-recoverpe-white px-4 py-2 text-sm font-medium text-recoverpe-black hover:bg-recoverpe-grey-light"
            >
              Contact support
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
