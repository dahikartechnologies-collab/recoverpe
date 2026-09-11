"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PAYMENT_MODES,
  EXPENSE_PAYMENT_MODE_LABELS,
  createExpense,
} from "@/lib/expenses";
import { Expense, ExpenseCategory, ExpensePaymentMode } from "@/types";

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (expense: Expense) => void;
}

const SELECT_CLASS =
  "focus-ring w-full rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2.5 text-sm text-recoverpe-black transition-all duration-200 ease-out focus:border-recoverpe-black disabled:cursor-not-allowed disabled:opacity-50";

const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-recoverpe-black";

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddExpenseModal({
  isOpen,
  onClose,
  onCreated,
}: AddExpenseModalProps) {
  const [payeeName, setPayeeName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("raw_material");
  const [paymentMode, setPaymentMode] =
    useState<ExpensePaymentMode>("bank_transfer");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayInputValue);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  function resetForm() {
    setPayeeName("");
    setAmount("");
    setCategory("raw_material");
    setPaymentMode("bank_transfer");
    setReferenceNumber("");
    setExpenseDate(todayInputValue());
    setNotes("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const expense = await createExpense({
        payee_name: payeeName,
        amount: Number(amount),
        category,
        payment_mode: paymentMode,
        reference_number: referenceNumber || null,
        expense_date: expenseDate,
        notes: notes || null,
      });

      onCreated(expense);
      resetForm();
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to record expense."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record expense"
      disableClose={isSubmitting}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="expense-payee" className={LABEL_CLASS}>
            Paid to
          </label>
          <Input
            id="expense-payee"
            value={payeeName}
            onChange={(event) => setPayeeName(event.target.value)}
            placeholder="Supplier or vendor name"
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="expense-amount" className={LABEL_CLASS}>
              Amount
            </label>
            <Input
              id="expense-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              required
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="expense-date" className={LABEL_CLASS}>
              Date
            </label>
            <Input
              id="expense-date"
              type="date"
              value={expenseDate}
              onChange={(event) => setExpenseDate(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="expense-category" className={LABEL_CLASS}>
              Category
            </label>
            <select
              id="expense-category"
              className={SELECT_CLASS}
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as ExpenseCategory)
              }
              disabled={isSubmitting}
            >
              {EXPENSE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {EXPENSE_CATEGORY_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="expense-payment-mode" className={LABEL_CLASS}>
              Payment mode
            </label>
            <select
              id="expense-payment-mode"
              className={SELECT_CLASS}
              value={paymentMode}
              onChange={(event) =>
                setPaymentMode(event.target.value as ExpensePaymentMode)
              }
              disabled={isSubmitting}
            >
              {EXPENSE_PAYMENT_MODES.map((value) => (
                <option key={value} value={value}>
                  {EXPENSE_PAYMENT_MODE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="expense-reference" className={LABEL_CLASS}>
            Reference number <span className="text-recoverpe-grey-medium">(optional)</span>
          </label>
          <Input
            id="expense-reference"
            value={referenceNumber}
            onChange={(event) => setReferenceNumber(event.target.value)}
            placeholder="UTR, cheque number or bill number"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="expense-notes" className={LABEL_CLASS}>
            Notes <span className="text-recoverpe-grey-medium">(optional)</span>
          </label>
          <textarea
            id="expense-notes"
            className={`${SELECT_CLASS} min-h-20 resize-y`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What was this payment for?"
            disabled={isSubmitting}
          />
        </div>

        {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Record expense"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
