import { AdminRazorpayOrder } from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";

type RawAdminOrderRow = {
  id: string;
  user_id: string;
  razorpay_order_id: string;
  purchase_type: string;
  amount_paise: number;
  status: string;
  ledger_id: string | null;
  created_at: string;
  paid_at: string | null;
  users:
    | { email: string }
    | { email: string }[]
    | null;
};

function mapAdminOrderRow(row: RawAdminOrderRow): AdminRazorpayOrder {
  const userData = Array.isArray(row.users) ? row.users[0] : row.users;

  return {
    id: row.id,
    user_id: row.user_id,
    user_email: userData?.email ?? null,
    razorpay_order_id: row.razorpay_order_id,
    purchase_type: row.purchase_type,
    amount_paise: row.amount_paise,
    status: row.status as AdminRazorpayOrder["status"],
    ledger_id: row.ledger_id,
    created_at: row.created_at,
    paid_at: row.paid_at,
  };
}

export async function searchAdminRazorpayOrders(
  supabase: SupabaseClient,
  filters: {
    razorpayOrderId?: string | null;
    userId?: string | null;
  }
): Promise<AdminRazorpayOrder[]> {
  const razorpayOrderId = filters.razorpayOrderId?.trim() || null;
  const userId = filters.userId?.trim() || null;

  if (!razorpayOrderId && !userId) {
    return [];
  }

  let query = supabase
    .from("razorpay_orders")
    .select(
      `
      id,
      user_id,
      razorpay_order_id,
      purchase_type,
      amount_paise,
      status,
      ledger_id,
      created_at,
      paid_at,
      users (
        email
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(25);

  if (razorpayOrderId) {
    query = query.eq("razorpay_order_id", razorpayOrderId);
  }

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to search Razorpay orders.");
  }

  return ((data ?? []) as RawAdminOrderRow[]).map(mapAdminOrderRow);
}
