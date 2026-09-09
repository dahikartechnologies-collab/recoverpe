"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { getFirebaseAuth, logout } from "@/lib/auth";

export default function AccountSuspendedPage() {
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
            Account Suspended
          </h1>
          <p className="mt-3 text-sm text-recoverpe-grey-medium">
            Your Recoverpe account has been suspended by an administrator.
            Automated reminders and dashboard access are disabled until the
            suspension is lifted.
          </p>
          <p className="mt-2 text-sm text-recoverpe-grey-medium">
            If you believe this is a mistake, contact Recoverpe support.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button type="button" onClick={() => void handleSignOut()}>
              Sign out
            </Button>
            <Link
              href="mailto:support@recoverpe.com"
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
