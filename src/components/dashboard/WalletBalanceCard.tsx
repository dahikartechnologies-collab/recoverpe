import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/gst";

interface WalletBalanceCardProps {
  balance: number;
  onLogAdvance?: () => void;
  showLogAdvanceAction?: boolean;
}

export function WalletBalanceCard({
  balance,
  onLogAdvance,
  showLogAdvanceAction = false,
}: WalletBalanceCardProps) {
  const isAdvance = balance > 0;
  const isDue = balance < 0;
  const displayAmount = Math.abs(balance);

  return (
    <Card className="min-w-0 overflow-hidden border-2 border-recoverpe-grey-light">
      <CardContent className="min-w-0">
        <p className="type-eyebrow truncate">Khata wallet</p>
        <p
          className={`type-data-primary mt-4 truncate text-2xl md:text-3xl ${
            isAdvance
              ? "text-[#059669]"
              : isDue
                ? "text-[#EF4444]"
                : "text-recoverpe-black"
          }`}
        >
          {isAdvance
            ? `Advance: ${formatCurrency(displayAmount)}`
            : isDue
              ? `Due: ${formatCurrency(displayAmount)}`
              : formatCurrency(0)}
        </p>
        <p className="type-data-secondary mt-3 leading-relaxed">
          {isAdvance
            ? "Prepaid balance available to apply against new invoices."
            : isDue
              ? "Net amount owed on this vendor's running khata."
              : "No advance balance on file. Log a payment to build credit."}
        </p>
        {showLogAdvanceAction && onLogAdvance ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-4 w-full"
            onClick={onLogAdvance}
          >
            + Log Advance
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
