"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

interface PremiumUpgradeLockProps {
  title: string;
  description: string;
  eyebrow?: string;
  ctaLabel?: string;
}

export function PremiumUpgradeLock({
  title,
  description,
  eyebrow = "Premium feature",
  ctaLabel = "Upgrade to Premium",
}: PremiumUpgradeLockProps) {
  return (
    <Card className="border-dashed border-recoverpe-grey-light">
      <CardContent className="space-y-3 p-5">
        <p className="type-eyebrow">{eyebrow}</p>
        <h3 className="text-base font-semibold text-recoverpe-black">{title}</h3>
        <p className="text-sm text-recoverpe-grey-medium">{description}</p>
        <Link href="/dashboard/billing">
          <Button type="button">{ctaLabel}</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
