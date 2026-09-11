import { Suspense } from "react";
import { ReconciliationsClient } from "@/components/dashboard/ReconciliationsClient";

export default function ReconciliationsPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-recoverpe-grey-medium">
          Loading payment proofs...
        </p>
      }
    >
      <ReconciliationsClient />
    </Suspense>
  );
}
