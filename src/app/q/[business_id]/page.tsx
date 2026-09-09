import { notFound } from "next/navigation";
import { KhataQrPageClient } from "@/components/khata/KhataQrPageClient";
import { fetchPublicKhataBusiness } from "@/lib/khata-qr";

interface KhataQrPageProps {
  params: {
    business_id: string;
  };
}

export default async function KhataQrPage({ params }: KhataQrPageProps) {
  const business = await fetchPublicKhataBusiness(params.business_id);

  if (!business) {
    notFound();
  }

  return (
    <KhataQrPageClient
      businessId={business.id}
      businessName={business.business_name}
    />
  );
}
