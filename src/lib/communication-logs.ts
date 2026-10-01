import { SupabaseClient } from "@supabase/supabase-js";
import {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationLog,
  CommunicationStatus,
  CommunicationType,
  WhatsAppMessageType,
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
  recipientPhone?: string | null;
  messageBody?: string | null;
  messageType?: WhatsAppMessageType | null;
  failureReason?: string | null;
}

const UNDEFINED_COLUMN = "42703";
const INVALID_ENUM_VALUE = "22P02";
const MESSAGE_BODY_MAX_LENGTH = 4096;

// Meta can deliver receipts out of order, so a late "delivered" must not
// overwrite a "read" that already arrived. Higher rank wins.
const STATUS_RANK: Record<CommunicationStatus, number> = {
  pending: 0,
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

/** Message types that count toward the one-reminder-per-day dedup gate. */
export const REMINDER_DEDUP_MESSAGE_TYPES: WhatsAppMessageType[] = [
  "reminder",
  "legal_notice",
];

export function mapMetaStatus(value: string): CommunicationStatus | null {
  return META_STATUS_MAP[value] ?? null;
}

function isTransparencySchemaMissing(error: { code?: string } | null): boolean {
  return error?.code === UNDEFINED_COLUMN || error?.code === INVALID_ENUM_VALUE;
}

function clampBody(body: string | null | undefined): string | null {
  if (!body) {
    return null;
  }

  return body.length > MESSAGE_BODY_MAX_LENGTH
    ? body.slice(0, MESSAGE_BODY_MAX_LENGTH)
    : body;
}

function buildBaseRow(input: RecordCommunicationInput) {
  return {
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
  };
}

function hasTransparencyFields(input: RecordCommunicationInput): boolean {
  return Boolean(
    input.recipientPhone || input.messageBody || input.messageType || input.failureReason
  );
}

export async function recordCommunication(
  supabase: SupabaseClient,
  input: RecordCommunicationInput
): Promise<string | null> {
  const baseRow = buildBaseRow(input);
  const row = hasTransparencyFields(input)
    ? {
        ...baseRow,
        recipient_phone: input.recipientPhone ?? null,
        message_body: clampBody(input.messageBody),
        message_type: input.messageType ?? null,
        failure_reason: input.failureReason ?? null,
      }
    : baseRow;

  let { data, error } = await supabase
    .from("communication_logs")
    .insert(row)
    .select("id")
    .single();

  // Pre-065 databases lack the outbox columns; keep the audit row anyway.
  if (error && row !== baseRow && isTransparencySchemaMissing(error)) {
    ({ data, error } = await supabase
      .from("communication_logs")
      .insert(baseRow)
      .select("id")
      .single());
  }

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

// ---------------------------------------------------------------------------
// WhatsApp outbox
// ---------------------------------------------------------------------------

export interface OutboundWhatsAppLogContext {
  userId: string;
  businessId?: string | null;
  contactId?: string | null;
  ledgerId?: string | null;
  messageType: WhatsAppMessageType;
  summary?: string | null;
}

export interface OutboundWhatsAppLogHandle {
  id: string | null;
  context: OutboundWhatsAppLogContext;
  recipientPhone: string;
  messageBody: string;
}

const DEFAULT_OUTBOUND_SUMMARY: Record<WhatsAppMessageType, string> = {
  reminder: "Payment reminder sent on WhatsApp",
  receipt: "Receipt sent on WhatsApp",
  legal_notice: "Legal notice sent on WhatsApp",
  reply: "Reply sent on WhatsApp",
  parchi: "Purchase confirmation sent on WhatsApp",
  marketing: "Promotional message sent on WhatsApp",
};

/**
 * Writes the exact outbound text as `pending` before Meta is called, so a
 * crash between dispatch and logging still leaves a trace of the attempt.
 */
export async function beginOutboundWhatsAppLog(
  supabase: SupabaseClient,
  context: OutboundWhatsAppLogContext,
  message: { recipientPhone: string; messageBody: string }
): Promise<OutboundWhatsAppLogHandle> {
  const handle: OutboundWhatsAppLogHandle = {
    id: null,
    context,
    recipientPhone: message.recipientPhone,
    messageBody: message.messageBody,
  };

  const { data, error } = await supabase
    .from("communication_logs")
    .insert({
      user_id: context.userId,
      business_id: context.businessId ?? null,
      contact_id: context.contactId ?? null,
      ledger_id: context.ledgerId ?? null,
      type: "whatsapp_reminder",
      channel: "whatsapp",
      direction: "outbound",
      status: "pending",
      summary: context.summary ?? DEFAULT_OUTBOUND_SUMMARY[context.messageType],
      recipient_phone: message.recipientPhone,
      message_body: clampBody(message.messageBody),
      message_type: context.messageType,
      cost_deducted: 0,
      executed_at: new Date().toISOString(),
      status_updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    if (!isTransparencySchemaMissing(error)) {
      console.error("[WHATSAPP OUTBOX] Failed to open log entry:", error.message);
    }

    return handle;
  }

  handle.id = (data?.id as string) ?? null;
  return handle;
}

export async function completeOutboundWhatsAppLog(
  supabase: SupabaseClient,
  handle: OutboundWhatsAppLogHandle,
  outcome: {
    status: "sent" | "failed";
    externalMessageId?: string | null;
    failureReason?: string | null;
    simulated?: boolean;
  }
): Promise<void> {
  const { context } = handle;
  const baseSummary = context.summary ?? DEFAULT_OUTBOUND_SUMMARY[context.messageType];
  const summary =
    outcome.status === "failed"
      ? `Delivery failed: ${outcome.failureReason ?? "unknown error"}`.slice(0, 500)
      : outcome.simulated
        ? `${baseSummary} (simulated in development)`
        : baseSummary;

  if (handle.id) {
    const { error } = await supabase
      .from("communication_logs")
      .update({
        status: outcome.status,
        external_message_id: outcome.externalMessageId ?? null,
        failure_reason: outcome.status === "failed" ? outcome.failureReason ?? null : null,
        summary,
        status_updated_at: new Date().toISOString(),
      })
      .eq("id", handle.id);

    if (error) {
      console.error("[WHATSAPP OUTBOX] Failed to close log entry:", error.message);
    }

    return;
  }

  // Before migration 065 only reminder-class sends were ever logged; logging
  // receipts there would trip the daily reminder dedup gate.
  if (!REMINDER_DEDUP_MESSAGE_TYPES.includes(context.messageType)) {
    return;
  }

  await recordCommunicationSafely(supabase, {
    userId: context.userId,
    businessId: context.businessId,
    contactId: context.contactId,
    ledgerId: context.ledgerId,
    type: "whatsapp_reminder",
    channel: "whatsapp",
    direction: "outbound",
    status: outcome.status,
    externalMessageId: outcome.externalMessageId ?? null,
    summary,
  });
}

/**
 * True when any reminder-class message was logged for these ledgers in the
 * window. Receipts are excluded so a khata receipt does not suppress the
 * day's autopilot reminder.
 */
export async function hasReminderInWindow(
  supabase: SupabaseClient,
  input: {
    ledgerIds: string[];
    types: CommunicationType[];
    startIso: string;
    endIso: string;
  }
): Promise<boolean> {
  if (input.ledgerIds.length === 0) {
    return false;
  }

  const baseQuery = () =>
    supabase
      .from("communication_logs")
      .select("id")
      .in("ledger_id", input.ledgerIds)
      .in("type", input.types)
      .gte("executed_at", input.startIso)
      .lte("executed_at", input.endIso);

  let { data, error } = await baseQuery()
    .or(
      `message_type.is.null,message_type.in.(${REMINDER_DEDUP_MESSAGE_TYPES.join(",")})`
    )
    .limit(1);

  if (error && error.code === UNDEFINED_COLUMN) {
    ({ data, error } = await baseQuery().limit(1));
  }

  if (error) {
    throw new Error(error.message || "Failed to check reminder dedup.");
  }

  return (data?.length ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Meta delivery receipts
// ---------------------------------------------------------------------------

export interface MetaStatusError {
  code?: number;
  title?: string;
  message?: string;
  error_data?: { details?: string };
}

/** One entry of `value.statuses[]` in a Meta WhatsApp Cloud API webhook. */
export interface MetaStatusUpdate {
  id?: string;
  status?: "sent" | "delivered" | "read" | "failed" | string;
  timestamp?: string;
  recipient_id?: string;
  conversation?: {
    id?: string;
    origin?: { type?: string };
    expiration_timestamp?: string;
  };
  pricing?: {
    billable?: boolean;
    pricing_model?: string;
    category?: string;
  };
  errors?: MetaStatusError[];
}

function metaTimestampToIso(value: string | undefined): string {
  const seconds = Number(value);

  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : new Date().toISOString();
}

function describeMetaFailure(errors: MetaStatusError[] | undefined): string | null {
  const first = errors?.[0];

  if (!first) {
    return null;
  }

  const detail = first.error_data?.details || first.message || first.title || null;
  const label = [first.code ? `#${first.code}` : null, detail].filter(Boolean).join(" ");

  return label ? label.slice(0, 500) : null;
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

    const { data: rows, error: lookupError } = await supabase
      .from("communication_logs")
      .select("id, status")
      .eq("external_message_id", externalMessageId)
      .eq("direction", "outbound")
      .limit(5);

    if (lookupError) {
      console.error(
        "[COMMUNICATION LOG] Delivery receipt lookup failed:",
        lookupError.message
      );
      continue;
    }

    const eventAt = metaTimestampToIso(entry.timestamp);
    const failureReason =
      nextStatus === "failed" ? describeMetaFailure(entry.errors) : null;

    for (const existing of rows ?? []) {
      const currentRank = STATUS_RANK[existing.status as CommunicationStatus] ?? 0;

      if (STATUS_RANK[nextStatus] <= currentRank) {
        continue;
      }

      const legacyPatch = {
        status: nextStatus,
        ...(failureReason ? { summary: `Delivery failed: ${failureReason}` } : {}),
      };
      const timestampPatch = {
        ...legacyPatch,
        status_updated_at: eventAt,
        ...(nextStatus === "delivered" ? { delivered_at: eventAt } : {}),
        ...(nextStatus === "read" ? { read_at: eventAt } : {}),
        ...(failureReason ? { failure_reason: failureReason } : {}),
      };

      let { error: updateError } = await supabase
        .from("communication_logs")
        .update(timestampPatch)
        .eq("id", existing.id);

      if (updateError && updateError.code === UNDEFINED_COLUMN) {
        ({ error: updateError } = await supabase
          .from("communication_logs")
          .update(legacyPatch)
          .eq("id", existing.id));
      }

      if (updateError) {
        console.error(
          "[COMMUNICATION LOG] Delivery receipt update failed:",
          updateError.message
        );
        continue;
      }

      updated += 1;
    }
  }

  return updated;
}

const HISTORY_BASE_COLUMNS =
  "id, ledger_id, user_id, business_id, contact_id, channel, direction, external_message_id, summary, type, status, cost_deducted, executed_at";
const HISTORY_OUTBOX_COLUMNS =
  ", recipient_phone, message_body, message_type, delivered_at, read_at, failure_reason";

export async function fetchContactCommunicationHistory(
  supabase: SupabaseClient,
  userId: string,
  contactId: string,
  limit = 50,
  options: { ledgerId?: string | null } = {}
): Promise<CommunicationLog[]> {
  const run = (columns: string) => {
    let query = supabase
      .from("communication_logs")
      .select(columns)
      .eq("user_id", userId)
      .eq("contact_id", contactId);

    if (options.ledgerId) {
      query = query.eq("ledger_id", options.ledgerId);
    }

    return query.order("executed_at", { ascending: false }).limit(limit);
  };

  let { data, error } = await run(HISTORY_BASE_COLUMNS + HISTORY_OUTBOX_COLUMNS);

  if (error && error.code === UNDEFINED_COLUMN) {
    ({ data, error } = await run(HISTORY_BASE_COLUMNS));
  }

  if (error) {
    throw new Error(error.message || "Failed to load communication history.");
  }

  return (data ?? []) as unknown as CommunicationLog[];
}
