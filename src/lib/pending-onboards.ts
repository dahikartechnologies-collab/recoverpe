import { formatIndianPhoneNumber } from "@/lib/invoices";
import { countUserLedgers } from "@/lib/razorpay";
import { FREE_PLAN_LEDGER_LIMIT } from "@/lib/razorpay-products";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { Contact, Ledger, PendingOnboard } from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";

type RawPendingOnboardRow = {
  id: string;
  business_id: string;
  customer_name: string;
  customer_phone: string;
  amount: number | string;
  status: PendingOnboard["status"];
  created_at: string;
};

function mapPendingOnboard(row: RawPendingOnboardRow): PendingOnboard {
  return {
    id: row.id,
    business_id: row.business_id,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    amount: Number(row.amount),
    status: row.status,
    created_at: row.created_at,
  };
}

const PENDING_ONBOARD_SELECT =
  "id, business_id, customer_name, customer_phone, amount, status, created_at";

async function assertLedgerQuota(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("subscription_plan")
    .eq("id", userId)
    .single();

  if (userError || !userRow) {
    throw new Error("User profile not found.");
  }

  if (userRow.subscription_plan === "free") {
    const ledgerCount = await countUserLedgers(supabase, userId);

    if (ledgerCount >= FREE_PLAN_LEDGER_LIMIT) {
      throw new Error(
        `Free plan is limited to ${FREE_PLAN_LEDGER_LIMIT} invoices. Upgrade to Premium to add more.`
      );
    }
  }
}

async function upsertContactForOnboard(
  supabase: SupabaseClient,
  userId: string,
  contactName: string,
  phoneNumber: string
): Promise<Contact> {
  const formattedPhone = formatIndianPhoneNumber(phoneNumber);

  const { data: existingContact, error: lookupError } = await supabase
    .from("contacts")
    .select(
      "id, user_id, name, phone_number, client_gstin, billing_address, created_at"
    )
    .eq("user_id", userId)
    .eq("phone_number", formattedPhone)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message || "Failed to lookup contact.");
  }

  if (existingContact) {
    const { data: updatedContact, error: updateError } = await supabase
      .from("contacts")
      .update({ name: contactName.trim() })
      .eq("id", existingContact.id)
      .select(
        "id, user_id, name, phone_number, client_gstin, billing_address, created_at"
      )
      .single();

    if (updateError || !updatedContact) {
      throw new Error(updateError?.message || "Failed to update contact.");
    }

    return updatedContact as Contact;
  }

  const { data: createdContact, error: createError } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      name: contactName.trim(),
      phone_number: formattedPhone,
    })
    .select(
      "id, user_id, name, phone_number, client_gstin, billing_address, created_at"
    )
    .single();

  if (createError || !createdContact) {
    throw new Error(createError?.message || "Failed to create contact.");
  }

  return createdContact as Contact;
}

async function createKhataLedger(input: {
  supabase: SupabaseClient;
  userId: string;
  businessId: string;
  contactId: string;
  amount: number;
}): Promise<Ledger> {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  const dueDateIso = dueDate.toISOString().slice(0, 10);

  const { data: ledger, error: ledgerError } = await input.supabase
    .from("ledgers")
    .insert({
      user_id: input.userId,
      contact_id: input.contactId,
      business_id: input.businessId,
      source_type: "manual_entry",
      total_amount: input.amount,
      balance_due: input.amount,
      due_date: dueDateIso,
      status: "pending",
      is_custom_pdf: false,
      pdf_url: null,
    })
    .select(
      "id, user_id, contact_id, business_id, invoice_number, source_type, total_amount, balance_due, due_date, status, is_custom_pdf, pdf_url, current_version, created_at, updated_at"
    )
    .single();

  if (ledgerError || !ledger) {
    throw new Error(ledgerError?.message || "Failed to create ledger entry.");
  }

  return ledger as Ledger;
}

export async function insertPendingOnboard(input: {
  businessId: string;
  customerName: string;
  customerPhone: string;
  amount: number;
}): Promise<PendingOnboard> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Amount must be a positive number.");
  }

  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("pending_onboards")
    .insert({
      business_id: input.businessId,
      customer_name: input.customerName.trim(),
      customer_phone: formatIndianPhoneNumber(input.customerPhone),
      amount: input.amount,
      status: "pending",
    })
    .select(PENDING_ONBOARD_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to save onboarding request.");
  }

  return mapPendingOnboard(data as RawPendingOnboardRow);
}

export async function autoApproveKhataOnboard(input: {
  businessId: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  amount: number;
}): Promise<{ contact: Contact; ledger: Ledger }> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Amount must be a positive number.");
  }

  const supabase = createAdminSupabaseClient();

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, user_id, khata_auto_approve")
    .eq("id", input.businessId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (businessError || !business) {
    throw new Error("Business not found.");
  }

  if (!business.khata_auto_approve) {
    throw new Error("Auto-approve is not enabled for this business.");
  }

  await assertLedgerQuota(supabase, input.userId);

  const contact = await upsertContactForOnboard(
    supabase,
    input.userId,
    input.customerName,
    input.customerPhone
  );

  const ledger = await createKhataLedger({
    supabase,
    userId: input.userId,
    businessId: input.businessId,
    contactId: contact.id,
    amount: input.amount,
  });

  return { contact, ledger };
}

export async function fetchPendingOnboardsForBusiness(
  supabase: SupabaseClient,
  userId: string,
  businessId: string
): Promise<PendingOnboard[]> {
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, khata_auto_approve")
    .eq("id", businessId)
    .eq("user_id", userId)
    .maybeSingle();

  if (businessError) {
    throw new Error(businessError.message || "Failed to verify business access.");
  }

  if (!business) {
    throw new Error("Business not found.");
  }

  const { data, error } = await supabase
    .from("pending_onboards")
    .select(PENDING_ONBOARD_SELECT)
    .eq("business_id", businessId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load pending onboards.");
  }

  return (data ?? []).map((row) => mapPendingOnboard(row as RawPendingOnboardRow));
}

export interface ApprovePendingOnboardResult {
  pending_onboard: PendingOnboard;
  contact: Contact;
  ledger: Ledger;
}

export async function approvePendingOnboard(input: {
  userId: string;
  pendingOnboardId: string;
  amount?: number;
}): Promise<ApprovePendingOnboardResult> {
  const supabase = createAdminSupabaseClient();

  const { data: pendingRow, error: pendingError } = await supabase
    .from("pending_onboards")
    .select(PENDING_ONBOARD_SELECT)
    .eq("id", input.pendingOnboardId)
    .maybeSingle();

  if (pendingError || !pendingRow) {
    throw new Error("Pending onboard request not found.");
  }

  if (pendingRow.status !== "pending") {
    throw new Error("This onboarding request has already been processed.");
  }

  const resolvedAmount = input.amount ?? Number(pendingRow.amount);

  if (!Number.isFinite(resolvedAmount) || resolvedAmount <= 0) {
    throw new Error("Amount must be a positive number.");
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, user_id")
    .eq("id", pendingRow.business_id)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (businessError || !business) {
    throw new Error("You do not have access to approve this request.");
  }

  await assertLedgerQuota(supabase, input.userId);

  const contact = await upsertContactForOnboard(
    supabase,
    input.userId,
    pendingRow.customer_name as string,
    pendingRow.customer_phone as string
  );

  const ledger = await createKhataLedger({
    supabase,
    userId: input.userId,
    businessId: pendingRow.business_id as string,
    contactId: contact.id,
    amount: resolvedAmount,
  });

  const { data: updatedPending, error: updateError } = await supabase
    .from("pending_onboards")
    .update({ status: "approved" })
    .eq("id", pendingRow.id)
    .select(PENDING_ONBOARD_SELECT)
    .single();

  if (updateError || !updatedPending) {
    throw new Error(updateError?.message || "Failed to mark onboarding as approved.");
  }

  return {
    pending_onboard: mapPendingOnboard(updatedPending as RawPendingOnboardRow),
    contact,
    ledger,
  };
}
