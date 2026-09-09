import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { resolveWorkspaceRoleContext } from "@/lib/workspace-rbac";
import { KioskAssignmentsResponse } from "@/types";

export async function GET(request: Request) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const roleContext = await resolveWorkspaceRoleContext(
      contextResult.effectiveUserId
    );

    if (roleContext.role !== "field_staff") {
      return NextResponse.json(
        { error: "Kiosk access is limited to field staff." },
        { status: 403 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: ledgers, error } = await supabase
      .from("ledgers")
      .select(
        `
        id,
        invoice_number,
        balance_due,
        due_date,
        business_id,
        contact_id,
        contacts (
          name,
          phone_number
        )
      `
      )
      .eq("assigned_to_user_id", contextResult.effectiveUserId)
      .gt("balance_due", 0)
      .order("due_date", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to load assigned vendors." },
        { status: 500 }
      );
    }

    const vendorMap = new Map<
      string,
      {
        contact_id: string;
        contact_name: string;
        phone_number: string;
        business_id: string | null;
        total_outstanding: number;
        ledgers: KioskAssignmentsResponse["vendors"][number]["ledgers"];
      }
    >();

    for (const ledger of ledgers ?? []) {
      const contact = Array.isArray(ledger.contacts)
        ? ledger.contacts[0]
        : ledger.contacts;

      if (!contact) {
        continue;
      }

      const contactId = ledger.contact_id as string;
      const existing = vendorMap.get(contactId);

      const ledgerEntry = {
        id: ledger.id as string,
        invoice_number: (ledger.invoice_number as string | null) ?? null,
        balance_due: Number(ledger.balance_due),
        due_date: ledger.due_date as string,
      };

      if (existing) {
        existing.total_outstanding += ledgerEntry.balance_due;
        existing.ledgers.push(ledgerEntry);
      } else {
        vendorMap.set(contactId, {
          contact_id: contactId,
          contact_name: contact.name as string,
          phone_number: contact.phone_number as string,
          business_id: (ledger.business_id as string | null) ?? null,
          total_outstanding: ledgerEntry.balance_due,
          ledgers: [ledgerEntry],
        });
      }
    }

    const response: KioskAssignmentsResponse = {
      business_name: roleContext.business_name,
      vendors: Array.from(vendorMap.values()).sort((left, right) =>
        left.contact_name.localeCompare(right.contact_name)
      ),
    };

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load kiosk assignments.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
