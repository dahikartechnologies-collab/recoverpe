import { NextResponse } from "next/server";
import {
  getRequestedBusinessIdFromRequest,
  ghostModeWriteBlockedResponse,
  resolveEffectiveUserContext,
} from "@/lib/api-auth";
import { isExpenseCategory, isExpensePaymentMode } from "@/lib/expenses";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { getTodayDateStringInIst } from "@/lib/timezone";
import { canMutateLedgers } from "@/lib/workspace-permissions";
import { resolveWorkspaceAccess } from "@/lib/workspace-rbac";
import { Expense } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Expenses expose whole-business spend, which field staff should not see even
 * though they can act on individual ledgers.
 */
async function assertExpenseAccess(
  actorUserId: string,
  workspaceUserId: string
): Promise<NextResponse | null> {
  const access = await resolveWorkspaceAccess(actorUserId, workspaceUserId);

  if (access.is_owner || canMutateLedgers(access.role, access.custom_permissions)) {
    return null;
  }

  return NextResponse.json(
    { error: "You do not have access to workspace expenses." },
    { status: 403 }
  );
}

const EXPENSE_COLUMNS =
  "id, user_id, business_id, payee_name, amount, category, payment_mode, reference_number, expense_date, notes, created_at";

// expense_date is a plain DATE, so month comparison stays lexicographic.
function startOfCurrentIstMonth(): string {
  return `${getTodayDateStringInIst().slice(0, 7)}-01`;
}

export async function GET(request: Request) {
  const context = await resolveEffectiveUserContext(request);

  if ("error" in context) {
    return context.error;
  }

  try {
    const forbidden = await assertExpenseAccess(
      context.actorUserId,
      context.effectiveUserId
    );

    if (forbidden) {
      return forbidden;
    }

    const supabase = createAdminSupabaseClient();
    const businessId = getRequestedBusinessIdFromRequest(request);

    let query = supabase
      .from("expenses")
      .select(EXPENSE_COLUMNS)
      .eq("user_id", context.effectiveUserId)
      .order("expense_date", { ascending: false })
      .limit(200);

    query = businessId
      ? query.eq("business_id", businessId)
      : query.is("business_id", null);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const expenses = (data ?? []) as Expense[];
    const monthStart = startOfCurrentIstMonth();

    const summary = expenses.reduce(
      (accumulator, expense) => {
        const amount = Number(expense.amount) || 0;
        accumulator.total_all_time += amount;

        if (expense.expense_date >= monthStart) {
          accumulator.total_this_month += amount;
        }

        return accumulator;
      },
      { total_this_month: 0, total_all_time: 0 }
    );

    return NextResponse.json({ expenses, summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load expenses.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await resolveEffectiveUserContext(request);

  if ("error" in context) {
    return context.error;
  }

  const ghostBlocked = ghostModeWriteBlockedResponse(context);

  if (ghostBlocked) {
    return ghostBlocked;
  }

  try {
    const forbidden = await assertExpenseAccess(
      context.actorUserId,
      context.effectiveUserId
    );

    if (forbidden) {
      return forbidden;
    }

    const body = (await request.json()) as Record<string, unknown>;
    const payeeName = String(body.payee_name ?? "").trim();
    const amount = Number(body.amount);
    const expenseDate = String(body.expense_date ?? "").trim();

    if (!payeeName) {
      return NextResponse.json(
        { error: "Payee name is required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero." },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      return NextResponse.json(
        { error: "A valid expense date is required." },
        { status: 400 }
      );
    }

    if (!isExpenseCategory(body.category)) {
      return NextResponse.json(
        { error: "A valid category is required." },
        { status: 400 }
      );
    }

    if (!isExpensePaymentMode(body.payment_mode)) {
      return NextResponse.json(
        { error: "A valid payment mode is required." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const businessId = getRequestedBusinessIdFromRequest(request);

    // Never trust a client-supplied owner: scope to the resolved workspace.
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: context.effectiveUserId,
        business_id: businessId,
        payee_name: payeeName,
        amount,
        category: body.category,
        payment_mode: body.payment_mode,
        reference_number: String(body.reference_number ?? "").trim() || null,
        expense_date: expenseDate,
        notes: String(body.notes ?? "").trim() || null,
      })
      .select(EXPENSE_COLUMNS)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ expense: data as Expense }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to record expense.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
