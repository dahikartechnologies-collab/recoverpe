import { Card, CardContent } from "@/components/ui/Card";

interface AdminMetricCardProps {
  label: string;
  description: string;
  value: number | string;
  tabular?: boolean;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function AdminMetricCard({
  label,
  description,
  value,
  tabular = true,
}: AdminMetricCardProps) {
  const displayValue = typeof value === "number" ? formatCount(value) : value;

  return (
    <Card>
      <CardContent>
        <p className="type-eyebrow">{label}</p>
        <p className={`type-stat mt-3 ${tabular ? "tabular-nums" : ""}`}>
          {displayValue}
        </p>
        <p className="type-data-secondary mt-2">{description}</p>
      </CardContent>
    </Card>
  );
}

function formatCurrencyInr(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function AdminCurrencyMetricCard({
  label,
  description,
  value,
}: {
  label: string;
  description: string;
  value: number;
}) {
  return (
    <AdminMetricCard
      label={label}
      description={description}
      value={formatCurrencyInr(value)}
    />
  );
}
