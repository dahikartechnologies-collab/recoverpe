import { Card, CardContent } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/gst";

interface HeroMetricCardProps {
  label: string;
  description: string;
  value: number;
}

export function HeroMetricCard({ label, description, value }: HeroMetricCardProps) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="min-w-0">
        <p className="type-eyebrow truncate">{label}</p>
        <p className="type-data-primary mt-4 truncate text-2xl md:text-3xl">
          {formatCurrency(value)}
        </p>
        <p className="type-data-secondary mt-3 leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}
