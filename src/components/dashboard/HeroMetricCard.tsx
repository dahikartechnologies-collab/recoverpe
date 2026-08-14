import { Card, CardContent } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/gst";

interface HeroMetricCardProps {
  label: string;
  description: string;
  value: number;
}

export function HeroMetricCard({ label, description, value }: HeroMetricCardProps) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm font-medium text-recoverpe-grey-medium">{label}</p>
        <p className="mt-3 text-3xl font-semibold tabular-nums text-recoverpe-black">
          {formatCurrency(value)}
        </p>
        <p className="mt-2 text-xs text-recoverpe-grey-medium">{description}</p>
      </CardContent>
    </Card>
  );
}
