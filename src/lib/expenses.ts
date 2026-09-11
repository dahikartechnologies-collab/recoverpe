import { getAuthHeaders } from "@/lib/auth-headers";
import { Expense, ExpenseCategory, ExpensePaymentMode } from "@/types";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  raw_material: "Raw Material",
  transport_freight: "Transport & Freight",
  rent: "Rent",
  utilities: "Utilities",
  salaries: "Salaries",
  office_expense: "Office Expense",
};

export const EXPENSE_PAYMENT_MODE_LABELS: Record<ExpensePaymentMode, string> = {
  bank_transfer: "Bank Transfer (NEFT/RTGS)",
  upi: "UPI",
  cash: "Cash",
  cheque: "Cheque",
};

export const EXPENSE_CATEGORIES = Object.keys(
  EXPENSE_CATEGORY_LABELS
) as ExpenseCategory[];

export const EXPENSE_PAYMENT_MODES = Object.keys(
  EXPENSE_PAYMENT_MODE_LABELS
) as ExpensePaymentMode[];

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(EXPENSE_CATEGORY_LABELS, value)
  );
}

export function isExpensePaymentMode(
  value: unknown
): value is ExpensePaymentMode {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(EXPENSE_PAYMENT_MODE_LABELS, value)
  );
}

export interface CreateExpenseInput {
  payee_name: string;
  amount: number;
  category: ExpenseCategory;
  payment_mode: ExpensePaymentMode;
  reference_number?: string | null;
  expense_date: string;
  notes?: string | null;
  gst_rate?: number;
  /** Defaults to true server-side: MSMEs quote and pay gross. */
  amount_includes_gst?: boolean;
  supplier_gstin?: string | null;
  hsn_sac_code?: string | null;
  place_of_supply?: string | null;
  tds_section?: string | null;
  is_input_credit_eligible?: boolean;
}

export interface ExpenseSummary {
  total_this_month: number;
  total_all_time: number;
}

export async function fetchExpenses(): Promise<{
  expenses: Expense[];
  summary: ExpenseSummary;
}> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/expenses", { headers });
  const payload = (await response.json()) as {
    expenses?: Expense[];
    summary?: ExpenseSummary;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "Failed to load expenses.");
  }

  return {
    expenses: payload.expenses ?? [],
    summary: payload.summary ?? { total_this_month: 0, total_all_time: 0 },
  };
}

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/expenses", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as {
    expense?: Expense;
    error?: string;
  };

  if (!response.ok || !payload.expense) {
    throw new Error(payload.error || "Failed to record expense.");
  }

  return payload.expense;
}
