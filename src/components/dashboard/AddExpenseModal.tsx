"use client";

import { FormEvent, useMemo, useState } from "react";
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
import { formatCurrency } from "@/lib/gst";
import {
  calculateExpenseTax,
  GST_RATES,
  GST_STATE_CODES,
  TDS_SECTIONS,
} from "@/lib/gst-compliance";
import { getTodayDateStringInIst } from "@/lib/timezone";
import { useWorkspaceStore } from "@/store/workspace-store";
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
  return getTodayDateStringInIst();
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
  const [gstRate, setGstRate] = useState(0);
  const [supplierGstin, setSupplierGstin] = useState("");
  const [hsnSacCode, setHsnSacCode] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [tdsSection, setTdsSection] = useState("");
  const [inputCreditEligible, setInputCreditEligible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const businessGstin = useWorkspaceStore(
    (state) => state.activeBusiness()?.gstin ?? null
  );

  // Mirrors the server-side derivation so the merchant sees the split before
  // saving. The server recomputes it from its own copy of the business GSTIN;
  // this is preview only.
  const preview = useMemo(() => {
    const parsed = Number(amount);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return calculateExpenseTax({
      enteredAmount: parsed,
      gstRate,
      isAmountInclusive: true,
      businessGstin,
      placeOfSupply: placeOfSupply.trim() || null,
      tdsSection: tdsSection || null,
    });
  }, [amount, gstRate, businessGstin, placeOfSupply, tdsSection]);

  function resetForm() {
    setPayeeName("");
    setAmount("");
    setCategory("raw_material");
    setPaymentMode("bank_transfer");
    setReferenceNumber("");
    setExpenseDate(todayInputValue());
    setNotes("");
    setGstRate(0);
    setSupplierGstin("");
    setHsnSacCode("");
    setPlaceOfSupply("");
    setTdsSection("");
    setInputCreditEligible(true);
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
        gst_rate: gstRate,
        amount_includes_gst: true,
        supplier_gstin: supplierGstin.trim().toUpperCase() || null,
        hsn_sac_code: hsnSacCode.trim() || null,
        place_of_supply: placeOfSupply || null,
        tds_section: tdsSection || null,
        is_input_credit_eligible: inputCreditEligible,
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

        <div className="rounded-md border border-recoverpe-grey-light p-4">
          <p className="text-sm font-medium text-recoverpe-black">
            GST &amp; TDS
          </p>
          <p className="mt-1 text-xs text-recoverpe-grey-medium">
            Needed for input tax credit. Leave the rate at 0% if the supplier
            is unregistered.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="expense-gst-rate" className={LABEL_CLASS}>
                GST rate
              </label>
              <select
                id="expense-gst-rate"
                className={SELECT_CLASS}
                value={gstRate}
                onChange={(event) => setGstRate(Number(event.target.value))}
                disabled={isSubmitting}
              >
                {GST_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}%
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="expense-place-of-supply" className={LABEL_CLASS}>
                Place of supply
              </label>
              <select
                id="expense-place-of-supply"
                className={SELECT_CLASS}
                value={placeOfSupply}
                onChange={(event) => setPlaceOfSupply(event.target.value)}
                disabled={isSubmitting}
              >
                <option value="">Same as my state</option>
                {Object.entries(GST_STATE_CODES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} — {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="expense-supplier-gstin" className={LABEL_CLASS}>
                Supplier GSTIN{" "}
                <span className="text-recoverpe-grey-medium">(optional)</span>
              </label>
              <Input
                id="expense-supplier-gstin"
                value={supplierGstin}
                onChange={(event) => setSupplierGstin(event.target.value)}
                placeholder="27AAAAA0000A1Z5"
                maxLength={15}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="expense-hsn" className={LABEL_CLASS}>
                HSN / SAC{" "}
                <span className="text-recoverpe-grey-medium">(optional)</span>
              </label>
              <Input
                id="expense-hsn"
                value={hsnSacCode}
                onChange={(event) => setHsnSacCode(event.target.value)}
                placeholder="9983"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="expense-tds" className={LABEL_CLASS}>
              TDS section{" "}
              <span className="text-recoverpe-grey-medium">(optional)</span>
            </label>
            <select
              id="expense-tds"
              className={SELECT_CLASS}
              value={tdsSection}
              onChange={(event) => setTdsSection(event.target.value)}
              disabled={isSubmitting}
            >
              <option value="">No TDS</option>
              {Object.entries(TDS_SECTIONS).map(([code, meta]) => (
                <option key={code} value={code}>
                  {meta.label} ({meta.rate}%)
                </option>
              ))}
            </select>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-recoverpe-black">
            <input
              type="checkbox"
              checked={inputCreditEligible}
              onChange={(event) => setInputCreditEligible(event.target.checked)}
              disabled={isSubmitting}
              className="h-4 w-4 rounded-sm border-recoverpe-grey-light"
            />
            Eligible for input tax credit
          </label>

          {preview ? (
            <dl className="mt-4 space-y-1 border-t border-recoverpe-grey-light pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-recoverpe-grey-medium">Taxable value</dt>
                <dd className="tabular-nums text-recoverpe-black">
                  {formatCurrency(preview.taxableValue)}
                </dd>
              </div>
              {preview.isInterState ? (
                <div className="flex justify-between">
                  <dt className="text-recoverpe-grey-medium">IGST</dt>
                  <dd className="tabular-nums text-recoverpe-black">
                    {formatCurrency(preview.igstAmount)}
                  </dd>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <dt className="text-recoverpe-grey-medium">CGST</dt>
                    <dd className="tabular-nums text-recoverpe-black">
                      {formatCurrency(preview.cgstAmount)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-recoverpe-grey-medium">SGST</dt>
                    <dd className="tabular-nums text-recoverpe-black">
                      {formatCurrency(preview.sgstAmount)}
                    </dd>
                  </div>
                </>
              )}
              {preview.tdsAmount > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-recoverpe-grey-medium">
                    TDS withheld ({preview.tdsRate}%)
                  </dt>
                  <dd className="tabular-nums text-recoverpe-error">
                    −{formatCurrency(preview.tdsAmount)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-recoverpe-grey-light pt-1 font-medium">
                <dt className="text-recoverpe-black">Net payable</dt>
                <dd className="tabular-nums text-recoverpe-black">
                  {formatCurrency(preview.netPayable)}
                </dd>
              </div>
            </dl>
          ) : null}
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
