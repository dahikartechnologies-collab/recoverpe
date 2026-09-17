"use client";

import { useCallback, useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { AccountingExportCard } from "@/components/dashboard/AccountingExportCard";
import { AddExpenseModal } from "@/components/dashboard/AddExpenseModal";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { formatCurrency } from "@/lib/gst";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PAYMENT_MODE_LABELS,
  ExpenseSummary,
  fetchExpenses,
} from "@/lib/expenses";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Expense } from "@/types";

function formatExpenseDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function ExpensesTableSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Date</TableHead>
              <TableHead>Voucher</TableHead>
              <TableHead>Paid to</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">GST</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index} className="pointer-events-none">
                <TableCell colSpan={8}>
                  <div className="h-4 animate-pulse rounded bg-[var(--rp-fill)]" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function ExpensesClient() {
  const mode = useWorkspaceStore((state) => state.mode);
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({
    total_this_month: 0,
    total_all_time: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadExpenses = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await fetchExpenses();
      setExpenses(result.expenses);
      setSummary(result.summary);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load expenses."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // The API scopes by the workspace cookie, so a workspace switch must refetch.
  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses, mode, activeBusinessId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Money paid out to suppliers, staff and overheads."
        actions={
          <Button type="button" onClick={() => setIsModalOpen(true)}>
            Record expense
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <CardContent className="min-w-0 p-5">
            <p className="type-eyebrow truncate">Spent This Month</p>
            <p className="type-stat mt-3 truncate">
              {isLoading ? "—" : formatCurrency(summary.total_this_month)}
            </p>
            <p className="type-data-secondary mt-2 leading-relaxed">
              Expenses dated in the current calendar month.
            </p>
          </CardContent>
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <CardContent className="min-w-0 p-5">
            <p className="type-eyebrow truncate">Total Recorded</p>
            <p className="type-stat mt-3 truncate">
              {isLoading ? "—" : formatCurrency(summary.total_all_time)}
            </p>
            <p className="type-data-secondary mt-2 leading-relaxed">
              All expenses captured in this workspace.
            </p>
          </CardContent>
        </Card>
      </div>

      <AccountingExportCard />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {isLoading ? (
        <ExpensesTableSkeleton />
      ) : expenses.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<Receipt className="h-5 w-5" aria-hidden />}
              title="No expenses recorded yet"
              description="Record what you pay out to see net cashflow against your receivables."
              action={
                <Button type="button" onClick={() => setIsModalOpen(true)}>
                  Record expense
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Paid to</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap text-recoverpe-black">
                      {formatExpenseDate(expense.expense_date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-recoverpe-muted">
                      {expense.voucher_number ?? "—"}
                    </TableCell>
                    <TableCell className="text-recoverpe-black">
                      {expense.payee_name}
                      {expense.supplier_gstin ? (
                        <span className="mt-0.5 block font-mono text-xs text-recoverpe-muted">
                          {expense.supplier_gstin}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge tone="neutral">
                        {EXPENSE_CATEGORY_LABELS[expense.category]}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge tone="neutral">
                        {EXPENSE_PAYMENT_MODE_LABELS[expense.payment_mode]}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-recoverpe-muted">
                      {formatCurrency(Number(expense.taxable_value ?? 0))}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-recoverpe-muted">
                      {formatCurrency(
                        Number(expense.cgst_amount ?? 0) +
                          Number(expense.sgst_amount ?? 0) +
                          Number(expense.igst_amount ?? 0)
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right type-data-primary text-recoverpe-danger-ink">
                      {formatCurrency(Number(expense.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AddExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={() => void loadExpenses()}
      />
    </div>
  );
}
