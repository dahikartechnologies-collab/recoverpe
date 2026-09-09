import { notFound } from "next/navigation";
import { PayPageClient } from "@/components/pay/PayPageClient";
import { fetchPublicPayLedger } from "@/lib/pay-page";

interface PayPageProps {
  params: {
    id: string;
  };
}

export default async function PayPage({ params }: PayPageProps) {
  const payData = await fetchPublicPayLedger(params.id);

  if (!payData) {
    notFound();
  }

  return <PayPageClient data={payData} />;
}
