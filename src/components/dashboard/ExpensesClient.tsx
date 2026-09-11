"use client";

import { useCallback, useEffect, useState } from "react";
import { AddExpenseModal } from "@/components/dashboard/AddExpenseModal";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-recoverpe-black">Expenses</h1>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Money paid out to suppliers, staff and overheads.
          </p>
        </div>
        <Button type="button" onClick={() => setIsModalOpen(true)}>
          Record expense
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <CardContent className="min-w-0 p-5">
            <p className="type-eyebrow truncate">Spent This Month</p>
            <p className="type-data-primary mt-3 truncate text-2xl">
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
            <p className="type-data-primary mt-3 truncate text-2xl">
              {isLoading ? "—" : formatCurrency(summary.total_all_time)}
            </p>
            <p className="type-data-secondary mt-2 leading-relaxed">
              All expenses captured in this workspace.
            </p>
          </CardContent>
        </Card>
      </div>

      {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-recoverpe-grey-medium">Loading expenses...</p>
      ) : expenses.length === 0 ? (
        <div className="rounded-md border border-dashed border-recoverpe-grey-light px-5 py-10 text-center">
          <p className="text-sm font-medium text-recoverpe-black">
            No expenses recorded yet
          </p>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Record what you pay out to see net cashflow against your receivables.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-recoverpe-grey-light">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-recoverpe-grey-light/40">
              <tr>
                <th className="px-4 py-3 font-medium text-recoverpe-black">Date</th>
                <th className="px-4 py-3 font-medium text-recoverpe-black">Paid to</th>
                <th className="px-4 py-3 font-medium text-recoverpe-black">Category</th>
                <th className="px-4 py-3 font-medium text-recoverpe-black">Mode</th>
                <th className="px-4 py-3 font-medium text-recoverpe-black">Reference</th>
                <th className="px-4 py-3 text-right font-medium text-recoverpe-black">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-recoverpe-grey-light bg-recoverpe-white">
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-recoverpe-black">
                    {formatExpenseDate(expense.expense_date)}
                  </td>
                  <td className="px-4 py-3 text-recoverpe-black">
                    {expense.payee_name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-recoverpe-grey-medium">
                    {EXPENSE_CATEGORY_LABELS[expense.category]}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-recoverpe-grey-medium">
                    {EXPENSE_PAYMENT_MODE_LABELS[expense.payment_mode]}
                  </td>
                  <td className="px-4 py-3 text-recoverpe-grey-medium">
                    {expense.reference_number ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-recoverpe-error">
                    {formatCurrency(Number(expense.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={() => void loadExpenses()}
      />
    </div>
  );
}
