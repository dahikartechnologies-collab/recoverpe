import { NextResponse } from "next/server";
import {
  getRequestedBusinessIdFromRequest,
  ghostModeWriteBlockedResponse,
  resolveEffectiveUserContext,
} from "@/lib/api-auth";
import { isExpenseCategory, isExpensePaymentMode } from "@/lib/expenses";
import {
  calculateExpenseTax,
  isValidGstin,
  isValidGstRate,
  TDS_SECTIONS,
} from "@/lib/gst-compliance";
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
  "id, user_id, business_id, payee_name, amount, category, payment_mode, reference_number, expense_date, notes, created_at, voucher_number, supplier_gstin, hsn_sac_code, place_of_supply, gst_rate, taxable_value, cgst_amount, sgst_amount, igst_amount, is_input_credit_eligible, tds_section, tds_rate, tds_amount";

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

    const gstRate = Number(body.gst_rate ?? 0);

    if (!isValidGstRate(gstRate)) {
      return NextResponse.json(
        { error: "GST rate must be one of 0, 0.25, 3, 5, 12, 18, or 28." },
        { status: 400 }
      );
    }

    const supplierGstin =
      String(body.supplier_gstin ?? "").trim().toUpperCase() || null;

    if (supplierGstin && !isValidGstin(supplierGstin)) {
      return NextResponse.json(
        { error: "Supplier GSTIN is not a valid 15-character GSTIN." },
        { status: 400 }
      );
    }

    const tdsSection = String(body.tds_section ?? "").trim() || null;

    if (tdsSection && !(tdsSection in TDS_SECTIONS)) {
      return NextResponse.json(
        { error: "Unrecognised TDS section." },
        { status: 400 }
      );
    }

    // The business GSTIN decides registration status and the home state, so
    // it must come from the database rather than the request body.
    let businessGstin: string | null = null;

    if (businessId) {
      const { data: business } = await supabase
        .from("businesses")
        .select("gstin")
        .eq("id", businessId)
        .eq("user_id", context.effectiveUserId)
        .maybeSingle();

      businessGstin = (business?.gstin as string | null) ?? null;
    }

    // Derived server-side: a tampered split would flow into a GSTR-3B figure
    // the merchant actually files.
    const tax = calculateExpenseTax({
      enteredAmount: amount,
      gstRate,
      isAmountInclusive: body.amount_includes_gst !== false,
      businessGstin,
      placeOfSupply: String(body.place_of_supply ?? "").trim() || null,
      tdsSection,
    });

    const { data: voucherNumber, error: voucherError } = await supabase.rpc(
      "next_expense_voucher_number",
      {
        p_user_id: context.effectiveUserId,
        p_business_id: businessId,
      }
    );

    if (voucherError) {
      return NextResponse.json(
        { error: voucherError.message || "Failed to allocate voucher number." },
        { status: 500 }
      );
    }

    // Never trust a client-supplied owner: scope to the resolved workspace.
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: context.effectiveUserId,
        business_id: businessId,
        payee_name: payeeName,
        amount: tax.grossAmount,
        category: body.category,
        payment_mode: body.payment_mode,
        reference_number: String(body.reference_number ?? "").trim() || null,
        expense_date: expenseDate,
        notes: String(body.notes ?? "").trim() || null,
        voucher_number: voucherNumber as string,
        supplier_gstin: supplierGstin,
        hsn_sac_code: String(body.hsn_sac_code ?? "").trim() || null,
        place_of_supply: String(body.place_of_supply ?? "").trim() || null,
        gst_rate: gstRate,
        taxable_value: tax.taxableValue,
        cgst_amount: tax.cgstAmount,
        sgst_amount: tax.sgstAmount,
        igst_amount: tax.igstAmount,
        is_input_credit_eligible: body.is_input_credit_eligible !== false,
        tds_section: tdsSection,
        tds_rate: tax.tdsRate,
        tds_amount: tax.tdsAmount,
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
