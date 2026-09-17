"use client";

import { Card, CardContent } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/gst";

interface PaymentSuccessCelebrationProps {
  amount: number;
  subtitle?: string;
}

export function PaymentSuccessCelebration({
  amount,
  subtitle = "Your khata has been updated automatically.",
}: PaymentSuccessCelebrationProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-8">
      <Card className="border-[#10B981]">
        <CardContent className="space-y-4 py-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#ECFDF5] text-3xl text-[#10B981]">
            ✓
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-[#047857]">
              Payment received
            </p>
            <h1 className="text-2xl font-semibold text-recoverpe-black">
              Payment Successfully Received!
            </h1>
            <p className="text-lg font-medium text-recoverpe-black">
              {formatCurrency(amount)}
            </p>
            <p className="text-sm text-recoverpe-grey-medium">{subtitle}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
