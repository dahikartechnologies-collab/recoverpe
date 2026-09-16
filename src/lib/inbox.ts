import { SupabaseClient } from "@supabase/supabase-js";
import { recordCommunicationSafely } from "@/lib/communication-logs";
import {
  InboxMessageRow,
  InboxThreadRow,
} from "@/lib/inbox-types";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp";

export type { InboxMessageRow, InboxThreadRow };

export async function listInboxThreads(
  supabase: SupabaseClient,
  workspaceUserId: string,
  businessId: string | null
): Promise<InboxThreadRow[]> {
  let query = supabase
    .from("communication_logs")
    .select("contact_id, summary, executed_at, direction, status")
    .eq("user_id", workspaceUserId)
    .eq("channel", "whatsapp")
    .not("contact_id", "is", null)
    .order("executed_at", { ascending: false })
    .limit(200);

  query = businessId
    ? query.eq("business_id", businessId)
    : query.is("business_id", null);

  const { data: logs, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to load inbox threads.");
  }

  const latestByContact = new Map<string, (typeof logs)[number]>();

  for (const row of logs ?? []) {
    const contactId = row.contact_id as string | null;

    if (!contactId || latestByContact.has(contactId)) {
      continue;
    }

    latestByContact.set(contactId, row);
  }

  const contactIds = Array.from(latestByContact.keys()).slice(0, 50);

  if (contactIds.length === 0) {
    return [];
  }

  const { data: contacts, error: contactError } = await supabase
    .from("contacts")
    .select("id, name, phone_number, bot_paused, debtor_health_score")
    .eq("user_id", workspaceUserId)
    .in("id", contactIds);

  if (contactError) {
    throw new Error(contactError.message || "Failed to load inbox contacts.");
  }

  const contactMap = new Map(
    (contacts ?? []).map((contact) => [contact.id as string, contact])
  );

  return contactIds.flatMap((contactId) => {
    const contact = contactMap.get(contactId);
    const last = latestByContact.get(contactId);

    if (!contact || !last) {
      return [];
    }

    return [
      {
        contact_id: contactId,
        name: contact.name as string,
        phone_number: contact.phone_number as string,
        last_at: (last.executed_at as string | null) ?? null,
        last_summary: (last.summary as string | null) ?? null,
        last_direction: (last.direction as "inbound" | "outbound" | null) ?? null,
        unread: last.direction === "inbound",
        bot_paused: Boolean(contact.bot_paused),
        dhs:
          typeof contact.debtor_health_score === "number"
            ? contact.debtor_health_score
            : null,
      },
    ];
  });
}

export async function listInboxThreadMessages(
  supabase: SupabaseClient,
  workspaceUserId: string,
  businessId: string | null,
  contactId: string
): Promise<InboxMessageRow[]> {
  let query = supabase
    .from("communication_logs")
    .select(
      "id, direction, summary, status, executed_at, external_message_id, contact_id"
    )
    .eq("user_id", workspaceUserId)
    .eq("contact_id", contactId)
    .eq("channel", "whatsapp")
    .order("executed_at", { ascending: true })
    .limit(100);

  query = businessId
    ? query.eq("business_id", businessId)
    : query.is("business_id", null);

  const { data: logs, error } = await query;

  if (error) {
    throw new Error(error.message || "Failed to load thread.");
  }

  const messageIds = (logs ?? [])
    .map((row) => row.external_message_id as string | null)
    .filter((value): value is string => Boolean(value));

  const proofsByMessage = new Map<
    string,
    { proof_url: string | null; status: string | null }
  >();

  if (messageIds.length > 0) {
    const { data: proofs } = await supabase
      .from("reconciliations")
      .select("external_message_id, proof_url, status")
      .eq("user_id", workspaceUserId)
      .eq("contact_id", contactId)
      .in("external_message_id", messageIds);

    for (const proof of proofs ?? []) {
      const key = proof.external_message_id as string | null;

      if (key) {
        proofsByMessage.set(key, {
          proof_url: (proof.proof_url as string | null) ?? null,
          status: (proof.status as string | null) ?? null,
        });
      }
    }
  }

  return (logs ?? []).map((row) => {
    const externalId = (row.external_message_id as string | null) ?? null;
    const proof = externalId ? proofsByMessage.get(externalId) : undefined;

    return {
      id: row.id as string,
      direction: row.direction as "inbound" | "outbound",
      summary: (row.summary as string | null) ?? null,
      status: row.status as string,
      executed_at: row.executed_at as string,
      external_message_id: externalId,
      proof_url: proof?.proof_url ?? null,
      proof_status: proof?.status ?? null,
    };
  });
}

export async function setContactBotPaused(
  supabase: SupabaseClient,
  workspaceUserId: string,
  contactId: string,
  paused: boolean
): Promise<void> {
  const { error } = await supabase
    .from("contacts")
    .update({ bot_paused: paused })
    .eq("id", contactId)
    .eq("user_id", workspaceUserId);

  if (error) {
    throw new Error(error.message || "Failed to update bot pause.");
  }
}

export async function sendOwnerInboxReply(
  supabase: SupabaseClient,
  input: {
    workspaceUserId: string;
    businessId: string | null;
    contactId: string;
    body: string;
  }
): Promise<void> {
  const { data: contact, error } = await supabase
    .from("contacts")
    .select("id, phone_number")
    .eq("id", input.contactId)
    .eq("user_id", input.workspaceUserId)
    .maybeSingle();

  if (error || !contact?.phone_number) {
    throw new Error(error?.message || "Contact not found.");
  }

  const sent = await sendWhatsAppTextMessage(
    contact.phone_number as string,
    input.body
  );

  if (!sent) {
    throw new Error("Failed to send WhatsApp reply.");
  }

  await recordCommunicationSafely(supabase, {
    userId: input.workspaceUserId,
    businessId: input.businessId,
    contactId: input.contactId,
    type: "whatsapp_reminder",
    channel: "whatsapp",
    direction: "outbound",
    status: "sent",
    summary: "Owner reply",
  });
}
