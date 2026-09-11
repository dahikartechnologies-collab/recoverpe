import { Suspense } from "react";
import { ExpensesClient } from "@/components/dashboard/ExpensesClient";

export default function ExpensesPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-recoverpe-grey-medium">Loading expenses...</p>
      }
    >
      <ExpensesClient />
    </Suspense>
  );
}
