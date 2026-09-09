import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import { revalidateDashboardData } from "@/lib/dashboard-cache";
import { MAX_CSV_FILE_SIZE_BYTES, MAX_CSV_FILE_SIZE_LABEL } from "@/lib/csv-import";
import { BatchLimitError, importLedgerBatch } from "@/lib/ledger-batch";
import { BatchImportPayload } from "@/types";

export const POST = withWorkspaceMutation(async (request, auth) => {
  try {
    const rawBody = await request.text();

    if (Buffer.byteLength(rawBody, "utf8") > MAX_CSV_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `Import payload exceeds the ${MAX_CSV_FILE_SIZE_LABEL} limit.`,
        },
        { status: 413 }
      );
    }

    const body = JSON.parse(rawBody) as BatchImportPayload;

    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json(
        { error: "rows must be a non-empty array." },
        { status: 400 }
      );
    }

    if (body.workspace_mode !== "personal" && body.workspace_mode !== "business") {
      return NextResponse.json(
        { error: "workspace_mode must be personal or business." },
        { status: 400 }
      );
    }

    if (body.workspace_mode === "business" && !body.business_id?.trim()) {
      return NextResponse.json(
        { error: "business_id is required for business imports." },
        { status: 400 }
      );
    }

    if (body.rows.length > 500) {
      return NextResponse.json(
        { error: "A single batch cannot exceed 500 rows." },
        { status: 400 }
      );
    }

    for (let index = 0; index < body.rows.length; index += 1) {
      const row = body.rows[index];

      if (!row.contact_name?.trim()) {
        return NextResponse.json(
          { error: `Row ${index + 1}: contact_name is required.` },
          { status: 400 }
        );
      }

      if (!row.phone_number?.trim()) {
        return NextResponse.json(
          { error: `Row ${index + 1}: phone_number is required.` },
          { status: 400 }
        );
      }

      if (!Number.isFinite(row.amount) || row.amount <= 0) {
        return NextResponse.json(
          { error: `Row ${index + 1}: amount must be a positive number.` },
          { status: 400 }
        );
      }

      if (!row.due_date?.trim()) {
        return NextResponse.json(
          { error: `Row ${index + 1}: due_date is required.` },
          { status: 400 }
        );
      }
    }

    const result = await importLedgerBatch({
      userId: auth.effectiveUserId,
      rows: body.rows,
      workspaceMode: body.workspace_mode,
      businessId:
        body.workspace_mode === "business" ? body.business_id?.trim() ?? null : null,
    });

    revalidateDashboardData(auth.effectiveUserId);

    return NextResponse.json({
      success: true,
      imported_count: result.imported_count,
      updated_count: result.updated_count,
      skipped_count: result.skipped_count,
      contact_count: result.contact_count,
      message:
        result.updated_count > 0
          ? `${result.imported_count} invoice(s) imported, ${result.updated_count} updated.`
          : `${result.imported_count} invoice(s) imported successfully.`,
    });
  } catch (error) {
    if (error instanceof BatchLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          ...error.details,
        },
        { status: 402 }
      );
    }

    throw error;
  }
}, { permission: "edit_ledgers" });
