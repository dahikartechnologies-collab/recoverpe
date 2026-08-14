"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { AdminAccessDeniedError } from "@/lib/admin-client";
import { getFirebaseAuth } from "@/lib/firebase";

interface UseAdminPageGuardResult {
  isReady: boolean;
  error: string;
}

export function useAdminPageGuard(
  load: () => Promise<void>
): UseAdminPageGuardResult {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      setIsReady(false);
      setError("");

      try {
        await load();
        setIsReady(true);
      } catch (loadError) {
        if (loadError instanceof AdminAccessDeniedError) {
          router.replace("/dashboard");
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load admin page."
        );
        setIsReady(false);
      }
    });

    return () => unsubscribe();
  }, [load, router]);

  return { isReady, error };
}
