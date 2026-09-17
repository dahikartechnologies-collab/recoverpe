import { Card, CardContent } from "@/components/ui/Card";

interface AdminMetricCardProps {
  label: string;
  description: string;
  value: number;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function AdminMetricCard({ label, description, value }: AdminMetricCardProps) {
  return (
    <Card>
      <CardContent>
        <p className="type-eyebrow">{label}</p>
        <p className="type-stat mt-3">{formatCount(value)}</p>
        <p className="type-data-secondary mt-2">{description}</p>
      </CardContent>
    </Card>
  );
}
