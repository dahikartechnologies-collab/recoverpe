import { SupabaseClient } from "@supabase/supabase-js";

export type DashboardActivityType = "smart_collect" | "wallet_advance";

export interface ReconciliationActivityItem {
  id: string;
  activity_type: DashboardActivityType;
  amount: number;
  vendor_name: string;
  invoices_paid_count: number;
  processed_at: string;
}

type InboundPaymentRow = {
  id: string;
  amount: number | string;
  processed_at: string | null;
  received_at: string;
  contacts: { name: string } | { name: string }[] | null;
};

type WalletAdvanceRow = {
  id: string;
  amount: number | string;
  logged_at: string;
  contact_id: string;
  contacts:
    | { name: string; user_id: string; wallet_balance: number | string }
    | { name: string; user_id: string; wallet_balance: number | string }[]
    | null;
};

async function resolveScopedContactIds(
  supabase: SupabaseClient,
  userId: string,
  contactIds: string[],
  businessId?: string | null
): Promise<Set<string>> {
  if (contactIds.length === 0) {
    return new Set();
  }

  const [{ data: contacts }, { data: ledgers }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, wallet_balance")
      .eq("user_id", userId)
      .in("id", contactIds),
    (() => {
      let query = supabase
        .from("ledgers")
        .select("contact_id")
        .eq("user_id", userId)
        .in("contact_id", contactIds);

      if (businessId) {
        query = query.eq("business_id", businessId);
      } else if (businessId === null) {
        query = query.is("business_id", null);
      }

      return query;
    })(),
  ]);

  const ledgerContactIds = new Set(
    (ledgers ?? []).map((row) => row.contact_id as string)
  );
  const scoped = new Set<string>();

  for (const contact of contacts ?? []) {
    const contactId = contact.id as string;
    const walletBalance = Number(contact.wallet_balance ?? 0);

    if (ledgerContactIds.has(contactId) || walletBalance > 0) {
      scoped.add(contactId);
    }
  }

  return scoped;
}

async function fetchSmartCollectActivity(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    businessId?: string | null;
    limit?: number;
  }
): Promise<ReconciliationActivityItem[]> {
  const limit = Math.min(Math.max(options?.limit ?? 10, 1), 20);

  let query = supabase
    .from("inbound_payments")
    .select(
      `
      id,
      amount,
      processed_at,
      received_at,
      contacts:contact_id (name)
    `
    )
    .eq("user_id", userId)
    .in("status", ["allocated", "partially_allocated"])
    .order("processed_at", { ascending: false, nullsFirst: false })
    .order("received_at", { ascending: false })
    .limit(limit);

  if (options?.businessId) {
    query = query.eq("business_id", options.businessId);
  } else if (options?.businessId === null) {
    query = query.is("business_id", null);
  }

  const { data: payments, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to load reconciliation activity.");
  }

  const rows = (payments ?? []) as InboundPaymentRow[];

  if (rows.length === 0) {
    return [];
  }

  const paymentIds = rows.map((payment) => payment.id);
  const { data: allocations, error: allocationError } = await supabase
    .from("payment_allocations")
    .select("inbound_payment_id")
    .in("inbound_payment_id", paymentIds);

  if (allocationError) {
    throw new Error(
      allocationError.message || "Failed to load payment allocations."
    );
  }

  const countByPayment = new Map<string, number>();

  for (const allocation of allocations ?? []) {
    const paymentId = allocation.inbound_payment_id as string;
    countByPayment.set(paymentId, (countByPayment.get(paymentId) ?? 0) + 1);
  }

  return rows.map((payment) => {
    const contact = Array.isArray(payment.contacts)
      ? payment.contacts[0]
      : payment.contacts;

    return {
      id: payment.id,
      activity_type: "smart_collect" as const,
      amount: Number(payment.amount),
      vendor_name: contact?.name?.trim() || "Unknown vendor",
      invoices_paid_count: countByPayment.get(payment.id) ?? 0,
      processed_at: payment.processed_at ?? payment.received_at,
    };
  });
}

async function fetchWalletAdvanceActivity(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    businessId?: string | null;
    limit?: number;
  }
): Promise<ReconciliationActivityItem[]> {
  const fetchLimit = Math.min(Math.max((options?.limit ?? 10) * 2, 10), 40);

  const { data, error } = await supabase
    .from("transactions")
    .select(
      `
      id,
      amount,
      logged_at,
      contact_id,
      contacts:contact_id (
        name,
        user_id,
        wallet_balance
      )
    `
    )
    .eq("transaction_type", "wallet_advance")
    .not("contact_id", "is", null)
    .order("logged_at", { ascending: false })
    .limit(fetchLimit);

  if (error) {
    throw new Error(error.message || "Failed to load wallet advance activity.");
  }

  const rows = (data ?? []) as WalletAdvanceRow[];
  const userRows = rows.filter((row) => {
    const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
    return contact?.user_id === userId;
  });

  if (userRows.length === 0) {
    return [];
  }

  const contactIds = Array.from(new Set(userRows.map((row) => row.contact_id)));
  const scopedContactIds = await resolveScopedContactIds(
    supabase,
    userId,
    contactIds,
    options?.businessId
  );

  return userRows
    .filter((row) => scopedContactIds.has(row.contact_id))
    .map((row) => {
      const contact = Array.isArray(row.contacts)
        ? row.contacts[0]
        : row.contacts;

      return {
        id: row.id,
        activity_type: "wallet_advance" as const,
        amount: Number(row.amount),
        vendor_name: contact?.name?.trim() || "Unknown vendor",
        invoices_paid_count: 0,
        processed_at: row.logged_at,
      };
    });
}

export async function fetchReconciliationActivity(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    businessId?: string | null;
    limit?: number;
  }
): Promise<ReconciliationActivityItem[]> {
  const limit = Math.min(Math.max(options?.limit ?? 10, 1), 20);

  const [smartCollectItems, walletAdvanceItems] = await Promise.all([
    fetchSmartCollectActivity(supabase, userId, options),
    fetchWalletAdvanceActivity(supabase, userId, options),
  ]);

  return [...smartCollectItems, ...walletAdvanceItems]
    .sort(
      (left, right) =>
        new Date(right.processed_at).getTime() -
        new Date(left.processed_at).getTime()
    )
    .slice(0, limit);
}
