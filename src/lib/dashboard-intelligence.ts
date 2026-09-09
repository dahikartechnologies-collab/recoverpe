import { DashboardMetrics, WorkspaceMode } from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";

export interface WallOfShameEntry {
  ledger_id: string;
  contact_name: string;
  balance_due: number;
  due_date: string;
  days_overdue: number;
}

export interface HostileCallAlert {
  communication_log_id: string;
  ledger_id: string;
  contact_name: string;
  balance_due: number;
  executive_summary: string | null;
  executed_at: string;
}

export interface PendingVerificationAlert {
  verification_id: string;
  ledger_id: string;
  contact_name: string;
  balance_due: number;
  claimed_amount: number | null;
  screenshot_url: string;
  submitted_at: string;
}

export interface DashboardIntelligence {
  wall_of_shame: WallOfShameEntry[];
  hostile_calls: HostileCallAlert[];
  pending_verifications: PendingVerificationAlert[];
}

type RpcMetricsRow = {
  total_outstanding: number | string;
  severely_overdue: number | string;
  recovered_via_recoverpe: number | string;
};

type RpcWallRow = {
  ledger_id: string;
  contact_name: string;
  balance_due: number | string;
  due_date: string;
  days_overdue: number | string;
};

export async function fetchDashboardMetricsViaRpc(
  supabase: SupabaseClient,
  userId: string,
  workspaceMode: WorkspaceMode,
  businessId: string | null
): Promise<DashboardMetrics> {
  const { data, error } = await supabase.rpc("get_dashboard_metrics", {
    p_user_id: userId,
    p_workspace_mode: workspaceMode,
    p_business_id: workspaceMode === "business" ? businessId : null,
  });

  if (error) {
    throw new Error(error.message || "Failed to load dashboard metrics.");
  }

  const row = (Array.isArray(data) ? data[0] : data) as RpcMetricsRow | null;

  return {
    totalOutstanding: Number(row?.total_outstanding ?? 0),
    severelyOverdue: Number(row?.severely_overdue ?? 0),
    recoveredViaRecoverpe: Number(row?.recovered_via_recoverpe ?? 0),
  };
}

export async function fetchWallOfShameViaRpc(
  supabase: SupabaseClient,
  userId: string,
  workspaceMode: WorkspaceMode,
  businessId: string | null,
  limit = 5,
  assignedToUserId?: string | null
): Promise<WallOfShameEntry[]> {
  const { data, error } = await supabase.rpc("get_wall_of_shame", {
    p_user_id: userId,
    p_workspace_mode: workspaceMode,
    p_business_id: workspaceMode === "business" ? businessId : null,
    p_limit: limit,
  });

  if (error) {
    throw new Error(error.message || "Failed to load wall of shame.");
  }

  let entries = ((data ?? []) as RpcWallRow[]).map((row) => ({
    ledger_id: row.ledger_id,
    contact_name: row.contact_name,
    balance_due: Number(row.balance_due),
    due_date: row.due_date,
    days_overdue: Number(row.days_overdue),
  }));

  if (assignedToUserId) {
    let ledgerQuery = supabase
      .from("ledgers")
      .select("id")
      .eq("user_id", userId)
      .eq("assigned_to_user_id", assignedToUserId);

    if (workspaceMode === "personal") {
      ledgerQuery = ledgerQuery.is("business_id", null);
    } else if (businessId) {
      ledgerQuery = ledgerQuery.eq("business_id", businessId);
    }

    const { data: assignedRows } = await ledgerQuery;
    const assignedIds = new Set((assignedRows ?? []).map((row) => row.id as string));
    entries = entries.filter((entry) => assignedIds.has(entry.ledger_id));
  }

  return entries;
}

export async function fetchHostileCallAlerts(
  supabase: SupabaseClient,
  userId: string,
  workspaceMode: WorkspaceMode,
  businessId: string | null,
  assignedToUserId?: string | null
): Promise<HostileCallAlert[]> {
  let ledgerQuery = supabase
    .from("ledgers")
    .select("id")
    .eq("user_id", userId);

  if (workspaceMode === "personal") {
    ledgerQuery = ledgerQuery.is("business_id", null);
  } else if (businessId) {
    ledgerQuery = ledgerQuery.eq("business_id", businessId);
  } else {
    return [];
  }

  if (assignedToUserId) {
    ledgerQuery = ledgerQuery.eq("assigned_to_user_id", assignedToUserId);
  }

  const { data: ledgerRows, error: ledgerError } = await ledgerQuery;

  if (ledgerError) {
    throw new Error(ledgerError.message || "Failed to scope hostile call alerts.");
  }

  const ledgerIds = (ledgerRows ?? []).map((row) => row.id as string);

  if (ledgerIds.length === 0) {
    return [];
  }

  const { data: logs, error: logsError } = await supabase
    .from("communication_logs")
    .select(
      `
      id,
      ledger_id,
      executive_summary,
      executed_at,
      ledgers (
        balance_due,
        contacts (
          name
        )
      )
    `
    )
    .eq("type", "vapi_call")
    .eq("sentiment", "hostile")
    .in("ledger_id", ledgerIds)
    .order("executed_at", { ascending: false })
    .limit(10);

  if (logsError) {
    throw new Error(logsError.message || "Failed to load hostile call alerts.");
  }

  type RawLogRow = {
    id: string;
    ledger_id: string;
    executive_summary: string | null;
    executed_at: string;
    ledgers:
      | {
          balance_due: number;
          contacts: { name: string } | { name: string }[] | null;
        }
      | {
          balance_due: number;
          contacts: { name: string } | { name: string }[] | null;
        }[]
      | null;
  };

  return ((logs ?? []) as RawLogRow[]).map((log) => {
    const ledgerData = Array.isArray(log.ledgers) ? log.ledgers[0] : log.ledgers;
    const contactData = Array.isArray(ledgerData?.contacts)
      ? ledgerData.contacts[0]
      : ledgerData?.contacts;

    return {
      communication_log_id: log.id,
      ledger_id: log.ledger_id,
      contact_name: contactData?.name ?? "Unknown",
      balance_due: Number(ledgerData?.balance_due ?? 0),
      executive_summary: log.executive_summary,
      executed_at: log.executed_at,
    };
  });
}

export async function fetchPendingVerificationAlerts(
  supabase: SupabaseClient,
  userId: string,
  workspaceMode: WorkspaceMode,
  businessId: string | null,
  assignedToUserId?: string | null
): Promise<PendingVerificationAlert[]> {
  const { data, error } = await supabase
    .from("payment_verifications")
    .select(
      `
      id,
      ledger_id,
      claimed_amount,
      screenshot_url,
      submitted_at,
      ledgers!inner (
        balance_due,
        business_id,
        contacts (
          name
        )
      )
    `
    )
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("submitted_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message || "Failed to load pending verifications.");
  }

  type RawVerificationRow = {
    id: string;
    ledger_id: string;
    claimed_amount: number | null;
    screenshot_url: string;
    submitted_at: string;
    ledgers:
      | {
          balance_due: number;
          business_id: string | null;
          contacts: { name: string } | { name: string }[] | null;
        }
      | {
          balance_due: number;
          business_id: string | null;
          contacts: { name: string } | { name: string }[] | null;
        }[];
  };

  let rows = (data ?? []) as RawVerificationRow[];

  if (assignedToUserId) {
    let ledgerQuery = supabase
      .from("ledgers")
      .select("id")
      .eq("user_id", userId)
      .eq("assigned_to_user_id", assignedToUserId);

    if (workspaceMode === "personal") {
      ledgerQuery = ledgerQuery.is("business_id", null);
    } else if (businessId) {
      ledgerQuery = ledgerQuery.eq("business_id", businessId);
    }

    const { data: assignedRows } = await ledgerQuery;
    const assignedLedgerIds = new Set(
      (assignedRows ?? []).map((row) => row.id as string)
    );

    rows = rows.filter((row) => assignedLedgerIds.has(row.ledger_id));
  }

  return rows
    .filter((row) => {
      const ledgerData = Array.isArray(row.ledgers) ? row.ledgers[0] : row.ledgers;

      if (workspaceMode === "personal") {
        return ledgerData?.business_id === null;
      }

      return ledgerData?.business_id === businessId;
    })
    .map((row) => {
      const ledgerData = Array.isArray(row.ledgers) ? row.ledgers[0] : row.ledgers;
      const contactData = Array.isArray(ledgerData?.contacts)
        ? ledgerData.contacts[0]
        : ledgerData?.contacts;

      return {
        verification_id: row.id,
        ledger_id: row.ledger_id,
        contact_name: contactData?.name ?? "Unknown",
        balance_due: Number(ledgerData?.balance_due ?? 0),
        claimed_amount:
          row.claimed_amount != null ? Number(row.claimed_amount) : null,
        screenshot_url: row.screenshot_url,
        submitted_at: row.submitted_at,
      };
    });
}

export async function fetchDashboardIntelligence(
  supabase: SupabaseClient,
  userId: string,
  workspaceMode: WorkspaceMode,
  businessId: string | null,
  assignedToUserId?: string | null
): Promise<DashboardIntelligence> {
  const [wall_of_shame, hostile_calls, pending_verifications] = await Promise.all([
    fetchWallOfShameViaRpc(
      supabase,
      userId,
      workspaceMode,
      businessId,
      5,
      assignedToUserId
    ),
    fetchHostileCallAlerts(
      supabase,
      userId,
      workspaceMode,
      businessId,
      assignedToUserId
    ),
    fetchPendingVerificationAlerts(
      supabase,
      userId,
      workspaceMode,
      businessId,
      assignedToUserId
    ),
  ]);

  return {
    wall_of_shame,
    hostile_calls,
    pending_verifications,
  };
}
