import { SupabaseClient } from "@supabase/supabase-js";
import {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationLog,
  CommunicationStatus,
  CommunicationType,
} from "@/types";

export interface RecordCommunicationInput {
  userId: string;
  businessId?: string | null;
  contactId?: string | null;
  ledgerId?: string | null;
  type: CommunicationType;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  status?: CommunicationStatus;
  externalMessageId?: string | null;
  summary?: string | null;
  costDeducted?: number;
}

// Meta can deliver receipts out of order, so a late "delivered" must not
// overwrite a "read" that already arrived. Higher rank wins.
const STATUS_RANK: Record<CommunicationStatus, number> = {
  sent: 1,
  delivered: 2,
  read: 3,
  call_completed: 3,
  failed: 4,
};

const META_STATUS_MAP: Record<string, CommunicationStatus> = {
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
};

export function mapMetaStatus(value: string): CommunicationStatus | null {
  return META_STATUS_MAP[value] ?? null;
}

export async function recordCommunication(
  supabase: SupabaseClient,
  input: RecordCommunicationInput
): Promise<string | null> {
  const { data, error } = await supabase
    .from("communication_logs")
    .insert({
      user_id: input.userId,
      business_id: input.businessId ?? null,
      contact_id: input.contactId ?? null,
      ledger_id: input.ledgerId ?? null,
      type: input.type,
      channel: input.channel,
      direction: input.direction,
      status: input.status ?? "sent",
      external_message_id: input.externalMessageId ?? null,
      summary: input.summary ?? null,
      cost_deducted: input.costDeducted ?? 0,
      executed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to log communication.");
  }

  return (data?.id as string) ?? null;
}

/**
 * Audit logging must never take down the message path that it observes.
 */
export async function recordCommunicationSafely(
  supabase: SupabaseClient,
  input: RecordCommunicationInput
): Promise<string | null> {
  try {
    return await recordCommunication(supabase, input);
  } catch (error) {
    console.error(
      "[COMMUNICATION LOG] Failed to record entry:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

export interface MetaStatusUpdate {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: Array<{ title?: string; message?: string }>;
}

/**
 * Applies Meta delivery receipts onto previously logged outbound messages.
 * Receipts for messages we never logged are ignored rather than inserted,
 * since a row without tenancy would be invisible to every workspace query.
 */
export async function applyWhatsAppDeliveryStatuses(
  supabase: SupabaseClient,
  statuses: MetaStatusUpdate[]
): Promise<number> {
  let updated = 0;

  for (const entry of statuses) {
    const externalMessageId = entry.id?.trim();
    const nextStatus = entry.status ? mapMetaStatus(entry.status) : null;

    if (!externalMessageId || !nextStatus) {
      continue;
    }

    const { data: existing, error: lookupError } = await supabase
      .from("communication_logs")
      .select("id, status")
      .eq("external_message_id", externalMessageId)
      .maybeSingle();

    if (lookupError) {
      console.error(
        "[COMMUNICATION LOG] Delivery receipt lookup failed:",
        lookupError.message
      );
      continue;
    }

    if (!existing) {
      continue;
    }

    const currentRank = STATUS_RANK[existing.status as CommunicationStatus] ?? 0;

    if (STATUS_RANK[nextStatus] <= currentRank) {
      continue;
    }

    const failureReason =
      nextStatus === "failed"
        ? entry.errors?.[0]?.title || entry.errors?.[0]?.message || null
        : null;

    const { error: updateError } = await supabase
      .from("communication_logs")
      .update({
        status: nextStatus,
        ...(failureReason ? { summary: failureReason } : {}),
      })
      .eq("id", existing.id);

    if (updateError) {
      console.error(
        "[COMMUNICATION LOG] Delivery receipt update failed:",
        updateError.message
      );
      continue;
    }

    updated += 1;
  }

  return updated;
}

export async function fetchContactCommunicationHistory(
  supabase: SupabaseClient,
  userId: string,
  contactId: string,
  limit = 50
): Promise<CommunicationLog[]> {
  const { data, error } = await supabase
    .from("communication_logs")
    .select(
      "id, ledger_id, user_id, business_id, contact_id, channel, direction, external_message_id, summary, type, status, cost_deducted, executed_at"
    )
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .order("executed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "Failed to load communication history.");
  }

  return (data ?? []) as CommunicationLog[];
}
