export interface InboxThreadRow {
  contact_id: string;
  name: string;
  phone_number: string;
  last_at: string | null;
  last_summary: string | null;
  last_direction: "inbound" | "outbound" | null;
  unread: boolean;
  bot_paused: boolean;
  dhs: number | null;
}

export interface InboxMessageRow {
  id: string;
  direction: "inbound" | "outbound";
  summary: string | null;
  status: string;
  executed_at: string;
  external_message_id: string | null;
  proof_url: string | null;
  proof_status: string | null;
}
