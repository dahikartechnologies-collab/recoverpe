"use client";

import { Check } from "lucide-react";
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
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center bg-recoverpe-canvas px-4 py-8">
      <Card className="border-recoverpe-success-line">
        <CardContent className="space-y-4 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-recoverpe-success-fill text-recoverpe-success-ink">
            <Check className="h-6 w-6" strokeWidth={2.5} aria-hidden />
          </div>
          <div className="space-y-2">
            <p className="type-eyebrow text-recoverpe-success-ink">Payment received</p>
            <p className="type-stat">{formatCurrency(amount)}</p>
            <p className="text-sm text-recoverpe-muted">{subtitle}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
