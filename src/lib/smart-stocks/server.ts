import { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { WorkspaceAuthContext } from "@/lib/auth-gateway";
import {
  COLLECTION_DETAILS_REQUIRED_MESSAGE,
  workspaceHasCollectionDetails,
} from "@/lib/collection-details";
import { refreshContactRiskScoreAsync } from "@/lib/contact-risk-score";
import { upsertContactForUser } from "@/lib/contact-upsert";
import { revalidateDashboardData } from "@/lib/dashboard-cache";
import { scheduleContactVirtualAccountProvisioning } from "@/lib/payments/provision-contact-virtual-account";
import { countUserLedgers } from "@/lib/razorpay";
import { FREE_PLAN_LEDGER_LIMIT } from "@/lib/razorpay-products";
import { shouldApplyFreeInvoiceLimits } from "@/lib/tier-fulfillment";
import { getTodayDateStringInIst } from "@/lib/timezone";
import { fireUdhaarReceiptMessage } from "@/lib/whatsapp/udhaar-receipt";
import { Business } from "@/types";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const VOICE_SALE_DUE_DAYS = 15;

const BUSINESS_POLICY_SELECT =
  "id, user_id, business_name, gstin, logo_url, msme_reg_no, invoice_prefix, financial_year_suffix, next_invoice_sequence, subscription_tier, subscription_status, subscription_expires_at, subscription_billing_tier, razorpay_subscription_id, addons, created_at";

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function smartStocksJsonError(
  scope: string,
  message: string,
  status: number,
  extra: Record<string, unknown> = {}
): NextResponse {
  if (status >= 500) {
    console.error(`[smart-stocks:${scope}] ${message}`, extra);
  } else {
    console.warn(`[smart-stocks:${scope}] ${status} ${message}`);
  }

  return NextResponse.json({ error: message, ...extra }, { status });
}

/**
 * Smart Stocks RLS admits can_manage_workspace (owner or admin). The API runs
 * as the service role, so it must re-apply that gate and the tenant check.
 */
export async function authorizeSmartStocksBusiness(
  supabase: SupabaseClient,
  auth: Pick<WorkspaceAuthContext, "isOwner" | "role" | "workspaceUserId">,
  businessId: unknown,
  scope: string
): Promise<{ business: Business } | { error: NextResponse }> {
  if (!isUuid(businessId)) {
    return {
      error: smartStocksJsonError(scope, "A valid business_id is required.", 400),
    };
  }

  if (!auth.isOwner && auth.role !== "admin") {
    return {
      error: smartStocksJsonError(
        scope,
        "Only the workspace owner or an admin can manage stock.",
        403
      ),
    };
  }

  const { data, error } = await supabase
    .from("businesses")
    .select(BUSINESS_POLICY_SELECT)
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    return { error: smartStocksJsonError(scope, error.message, 500) };
  }

  if (!data) {
    return { error: smartStocksJsonError(scope, "Business not found.", 404) };
  }

  if (data.user_id !== auth.workspaceUserId) {
    return {
      error: smartStocksJsonError(
        scope,
        "Forbidden. This business belongs to another workspace.",
        403
      ),
    };
  }

  return { business: data as unknown as Business };
}

const RPC_ERROR_STATUS: Record<string, number> = {
  INVALID_INPUT: 400,
  ITEM_NOT_FOUND: 404,
  CAPTURE_NOT_PENDING: 409,
  COMMAND_NOT_PENDING: 409,
  INSUFFICIENT_STOCK: 409,
};

const RPC_ERROR_MESSAGE: Record<string, string> = {
  CAPTURE_NOT_PENDING: "This parchi was already posted or rejected.",
  COMMAND_NOT_PENDING: "This command was already executed.",
  ITEM_NOT_FOUND: "A stock item in this request does not belong to this business.",
};

export function mapSmartStocksRpcError(error: {
  message?: string;
  code?: string;
}): { status: number; code: string; message: string } {
  const raw = error.message ?? "";
  const match = raw.match(/SMART_STOCKS:([A-Z_]+):?(.*)$/);

  if (match) {
    const code = match[1];
    const detail = match[2]?.trim();

    return {
      status: RPC_ERROR_STATUS[code] ?? 400,
      code,
      message:
        RPC_ERROR_MESSAGE[code] ??
        (code === "INSUFFICIENT_STOCK"
          ? `Not enough stock: ${detail}.`
          : detail || "Invalid stock request."),
    };
  }

  if (error.code === "22P02" || error.code === "22007" || error.code === "22008") {
    return { status: 400, code: "INVALID_INPUT", message: "Invalid id, number or date." };
  }

  if (error.code === "PGRST202" || error.code === "42883") {
    return {
      status: 503,
      code: "MIGRATION_REQUIRED",
      message: "Smart Stocks posting is not installed. Run migration 064 in Supabase.",
    };
  }

  return { status: 500, code: "DATABASE_ERROR", message: raw || "Database error." };
}

function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));

  return next.toISOString().slice(0, 10);
}

export type VoiceSaleLedgerCheck =
  | { ok: true; business: Business }
  | { ok: false; response: NextResponse };

/** Same pre-checks as POST /api/ledgers, run before any stock is deducted. */
export async function checkVoiceSaleLedgerAllowed(
  supabase: SupabaseClient,
  workspaceUserId: string,
  business: Business
): Promise<VoiceSaleLedgerCheck> {
  const collectionReady = await workspaceHasCollectionDetails(
    supabase,
    workspaceUserId,
    business.id
  );

  if (!collectionReady) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: COLLECTION_DETAILS_REQUIRED_MESSAGE,
          code: "collection_details_required",
        },
        { status: 403 }
      ),
    };
  }

  if (shouldApplyFreeInvoiceLimits(business)) {
    const priorLedgerCount = await countUserLedgers(supabase, workspaceUserId);

    if (priorLedgerCount >= FREE_PLAN_LEDGER_LIMIT) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: `Free plan is limited to ${FREE_PLAN_LEDGER_LIMIT} invoices. Upgrade to a paid plan to add more.`,
            upgrade_required: true,
            ledger_count: priorLedgerCount,
            ledger_limit: FREE_PLAN_LEDGER_LIMIT,
          },
          { status: 402 }
        ),
      };
    }
  }

  return { ok: true, business };
}

export interface VoiceSaleLedgerResult {
  ledgerId: string;
  contactId: string;
  contactName: string;
  phone: string;
  dueDate: string;
}

export async function createVoiceSaleLedger(
  supabase: SupabaseClient,
  input: {
    workspaceUserId: string;
    business: Business;
    customerName: string;
    customerPhone: string;
    amount: number;
  }
): Promise<VoiceSaleLedgerResult> {
  const { contact, isNew } = await upsertContactForUser(input.workspaceUserId, {
    contactName: input.customerName,
    phoneNumber: input.customerPhone,
  });

  if (isNew) {
    scheduleContactVirtualAccountProvisioning({
      userId: input.workspaceUserId,
      contactId: contact.id,
      contactName: contact.name,
    });
  }

  const dueDate = addDaysToDateString(getTodayDateStringInIst(), VOICE_SALE_DUE_DAYS);
  const { data: ledger, error } = await supabase
    .from("ledgers")
    .insert({
      user_id: input.workspaceUserId,
      contact_id: contact.id,
      business_id: input.business.id,
      invoice_number: null,
      source_type: "manual_entry",
      total_amount: input.amount,
      balance_due: input.amount,
      due_date: dueDate,
      status: "pending",
      is_custom_pdf: false,
      pdf_url: null,
      communication_autopilot: true,
    })
    .select("id")
    .single();

  if (error || !ledger) {
    throw new Error(error?.message || "Failed to create the khata entry.");
  }

  return {
    ledgerId: ledger.id as string,
    contactId: contact.id,
    contactName: contact.name,
    phone: contact.phone_number,
    dueDate,
  };
}

export function finalizeVoiceSaleLedger(
  supabase: SupabaseClient,
  workspaceUserId: string,
  contactId: string
): void {
  revalidateDashboardData(workspaceUserId);
  refreshContactRiskScoreAsync(supabase, contactId);
}

export async function sendVoiceSaleReceipt(input: {
  workspaceUserId: string;
  business: Business;
  ledger: VoiceSaleLedgerResult;
  amount: number;
}): Promise<boolean> {
  try {
    await fireUdhaarReceiptMessage({
      userId: input.workspaceUserId,
      contactId: input.ledger.contactId,
      contactName: input.ledger.contactName,
      phone: input.ledger.phone,
      amount: input.amount,
      businessId: input.business.id,
      businessName: input.business.business_name?.trim() || "Recoverpe",
      ledgerId: input.ledger.ledgerId,
    });

    return true;
  } catch (error) {
    console.error(
      "[smart-stocks:voice-execute] WhatsApp receipt failed:",
      error instanceof Error ? error.message : error
    );

    return false;
  }
}
