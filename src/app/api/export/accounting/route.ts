import { NextResponse } from "next/server";
import {
  getRequestedBusinessIdFromRequest,
  resolveEffectiveUserContext,
} from "@/lib/api-auth";
import {
  AccountingExportData,
  buildAccountingCsv,
  buildGstr3bSummary,
  buildTallyXml,
  PurchaseVoucher,
  ReceiptVoucher,
  SalesVoucher,
} from "@/lib/accounting-export";
import { calculateGstBreakdown } from "@/lib/gst";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { getIstDayBounds, RECOVERPE_TIMEZONE } from "@/lib/timezone";
import { formatInTimeZone } from "date-fns-tz";
import { canMutateLedgers } from "@/lib/workspace-permissions";
import { resolveWorkspaceAccess } from "@/lib/workspace-rbac";

export const dynamic = "force-dynamic";

type ExportFormat = "tally_xml" | "csv" | "json";

// A full year of vouchers for a busy distributor still has to fit inside a
// serverless response, so the window is bounded rather than unlimited.
const MAX_RANGE_DAYS = 400;

function parseFormat(value: string | null): ExportFormat | null {
  switch (value) {
    case "tally_xml":
    case "csv":
    case "json":
      return value;
    default:
      return null;
  }
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: Request) {
  const context = await resolveEffectiveUserContext(request);

  if ("error" in context) {
    return context.error;
  }

  try {
    // Accounting exports expose whole-business financials, so field staff and
    // recovery agents are excluded even though they can act on ledgers.
    const access = await resolveWorkspaceAccess(
      context.actorUserId,
      context.effectiveUserId
    );

    if (
      !access.is_owner &&
      !canMutateLedgers(access.role, access.custom_permissions)
    ) {
      return NextResponse.json(
        { error: "You do not have access to accounting exports." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const format = parseFormat(searchParams.get("format")) ?? "json";
    const fromDate = (searchParams.get("from") ?? "").trim();
    const toDate = (searchParams.get("to") ?? "").trim();

    if (!isIsoDate(fromDate) || !isIsoDate(toDate)) {
      return NextResponse.json(
        { error: "from and to must be YYYY-MM-DD dates." },
        { status: 400 }
      );
    }

    if (fromDate > toDate) {
      return NextResponse.json(
        { error: "from must be on or before to." },
        { status: 400 }
      );
    }

    const rangeDays =
      (Date.parse(toDate) - Date.parse(fromDate)) / (1000 * 60 * 60 * 24);

    if (rangeDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Export range cannot exceed ${MAX_RANGE_DAYS} days.` },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const businessId = getRequestedBusinessIdFromRequest(request);
    const { startIso: rangeStartIso } = getIstDayBounds(fromDate);
    const { endIso: rangeEndIso } = getIstDayBounds(toDate);

    let businessName = "Recoverpe Business";
    let businessGstin: string | null = null;

    if (businessId) {
      const { data: business } = await supabase
        .from("businesses")
        .select("business_name, gstin")
        .eq("id", businessId)
        .eq("user_id", context.effectiveUserId)
        .maybeSingle();

      if (!business) {
        return NextResponse.json(
          { error: "Business not found." },
          { status: 404 }
        );
      }

      businessName = business.business_name as string;
      businessGstin = (business.gstin as string | null) ?? null;
    }

    const scopeBusiness = <T extends { eq: unknown; is: unknown }>(query: T): T =>
      (businessId
        ? (query as { eq: (c: string, v: string) => T }).eq(
            "business_id",
            businessId
          )
        : (query as { is: (c: string, v: null) => T }).is(
            "business_id",
            null
          )) as T;

    const [ledgerResult, expenseResult] = await Promise.all([
      scopeBusiness(
        supabase
          .from("ledgers")
          .select(
            `id, invoice_number, total_amount, created_at,
             contacts ( name, client_gstin )`
          )
          .eq("user_id", context.effectiveUserId)
          .gte("created_at", rangeStartIso)
          .lte("created_at", rangeEndIso)
          .order("created_at", { ascending: true })
      ),
      scopeBusiness(
        supabase
          .from("expenses")
          .select("*")
          .eq("user_id", context.effectiveUserId)
          .gte("expense_date", fromDate)
          .lte("expense_date", toDate)
          .order("expense_date", { ascending: true })
      ),
    ]);

    if (ledgerResult.error || expenseResult.error) {
      return NextResponse.json(
        {
          error:
            ledgerResult.error?.message ||
            expenseResult.error?.message ||
            "Failed to load accounting data.",
        },
        { status: 500 }
      );
    }

    const ledgerRows = (ledgerResult.data ?? []) as Array<
      Record<string, unknown>
    >;
    const ledgerIds = ledgerRows.map((row) => row.id as string);

    const { data: transactionRows, error: transactionError } =
      ledgerIds.length > 0
        ? await supabase
            .from("transactions")
            .select(
              "id, ledger_id, amount, payment_method, reference_id, logged_at, transaction_type"
            )
            .in("ledger_id", ledgerIds)
            .eq("transaction_type", "payment_received")
            .gte("logged_at", rangeStartIso)
            .lte("logged_at", rangeEndIso)
            .order("logged_at", { ascending: true })
        : { data: [], error: null };

    if (transactionError) {
      return NextResponse.json(
        { error: transactionError.message },
        { status: 500 }
      );
    }

    const ledgerNameById = new Map<string, string>();

    const sales: SalesVoucher[] = ledgerRows.map((row, index) => {
      const contact = Array.isArray(row.contacts)
        ? (row.contacts[0] as Record<string, unknown> | undefined)
        : (row.contacts as Record<string, unknown> | undefined);
      const partyName = (contact?.name as string) ?? "Unknown";
      const partyGstin = (contact?.client_gstin as string | null) ?? null;
      const total = Number(row.total_amount);

      ledgerNameById.set(row.id as string, partyName);

      // Ledgers store only a gross total, so the split is reconstructed with
      // the same rule used to render the tax invoice.
      const breakdown = calculateGstBreakdown(total, businessGstin, partyGstin);

      return {
        date: formatInTimeZone(
          new Date(String(row.created_at)),
          RECOVERPE_TIMEZONE,
          "yyyy-MM-dd"
        ),
        voucherNumber:
          (row.invoice_number as string | null) ?? `INV-${index + 1}`,
        partyName,
        partyGstin,
        taxableValue: Number(breakdown.taxableAmount.toFixed(2)),
        cgst: Number(breakdown.cgst.toFixed(2)),
        sgst: Number(breakdown.sgst.toFixed(2)),
        igst: Number(breakdown.igst.toFixed(2)),
        total,
        narration: null,
      };
    });

    const receipts: ReceiptVoucher[] = (transactionRows ?? []).map(
      (row, index) => ({
        date: formatInTimeZone(
          new Date(String(row.logged_at)),
          RECOVERPE_TIMEZONE,
          "yyyy-MM-dd"
        ),
        voucherNumber: (row.reference_id as string | null) || `RCPT-${index + 1}`,
        partyName: ledgerNameById.get(row.ledger_id as string) ?? "Unknown",
        amount: Number(row.amount),
        paymentMode: (row.payment_method as string) ?? "bank_transfer",
        reference: (row.reference_id as string | null) ?? null,
      })
    );

    const purchases: PurchaseVoucher[] = (
      (expenseResult.data ?? []) as Array<Record<string, unknown>>
    ).map((row, index) => ({
      date: String(row.expense_date),
      voucherNumber:
        (row.voucher_number as string | null) ?? `EXP-${index + 1}`,
      payeeName: (row.payee_name as string) ?? "Unknown",
      supplierGstin: (row.supplier_gstin as string | null) ?? null,
      hsnSac: (row.hsn_sac_code as string | null) ?? null,
      taxableValue: Number(row.taxable_value ?? row.amount ?? 0),
      cgst: Number(row.cgst_amount ?? 0),
      sgst: Number(row.sgst_amount ?? 0),
      igst: Number(row.igst_amount ?? 0),
      total: Number(row.amount ?? 0),
      tdsSection: (row.tds_section as string | null) ?? null,
      tdsAmount: Number(row.tds_amount ?? 0),
      inputCreditEligible: row.is_input_credit_eligible !== false,
      category: String(row.category ?? "Indirect Expenses"),
      narration: (row.notes as string | null) ?? null,
    }));

    const data: AccountingExportData = {
      businessName,
      businessGstin,
      fromDate,
      toDate,
      sales,
      receipts,
      purchases,
    };

    const filenameBase = `recoverpe-books-${fromDate}-to-${toDate}`;

    if (format === "tally_xml") {
      return new NextResponse(buildTallyXml(data), {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenameBase}.xml"`,
        },
      });
    }

    if (format === "csv") {
      return new NextResponse(buildAccountingCsv(data), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
        },
      });
    }

    return NextResponse.json({
      ...data,
      gstr3b: buildGstr3bSummary(data),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build export.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
