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
        <p className="text-sm font-medium text-recoverpe-grey-medium">{label}</p>
        <p className="mt-3 text-3xl font-semibold tabular-nums text-recoverpe-black">
          {formatCount(value)}
        </p>
        <p className="mt-2 text-xs text-recoverpe-grey-medium">{description}</p>
      </CardContent>
    </Card>
  );
}
