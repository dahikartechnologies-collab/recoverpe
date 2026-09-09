import { SupabaseClient } from "@supabase/supabase-js";
import { AutopilotEscalationAlert } from "@/types";

export async function fetchAutopilotEscalationAlerts(
  supabase: SupabaseClient,
  userId: string,
  businessId: string | null
): Promise<AutopilotEscalationAlert[]> {
  let query = supabase
    .from("ledgers")
    .select(
      `
      id,
      invoice_number,
      balance_due,
      due_date,
      contacts:contact_id (
        name
      )
    `
    )
    .eq("user_id", userId)
    .eq("legal_escalation_ready", true)
    .gt("balance_due", 0)
    .not("status", "in", '("paid","cancelled","refunded")')
    .is("legal_notice_pdf_url", null)
    .order("due_date", { ascending: true })
    .limit(20);

  if (businessId) {
    query = query.eq("business_id", businessId);
  } else {
    query = query.is("business_id", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to load autopilot escalation alerts.");
  }

  return (data ?? []).map((row) => {
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;

    return {
      ledger_id: row.id as string,
      contact_name: (contact?.name as string | undefined) ?? "Unknown vendor",
      balance_due: Number(row.balance_due),
      due_date: row.due_date as string,
      invoice_number: (row.invoice_number as string | null) ?? null,
    };
  });
}
