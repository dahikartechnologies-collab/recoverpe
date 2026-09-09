import { Suspense } from "react";
import { VendorDetailClient } from "@/components/dashboard/VendorDetailClient";

interface VendorDetailPageProps {
  params: { id: string };
}

export default function VendorDetailPage({ params }: VendorDetailPageProps) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-recoverpe-grey-medium">Loading vendor...</p>
      }
    >
      <VendorDetailClient contactId={params.id} />
    </Suspense>
  );
}
