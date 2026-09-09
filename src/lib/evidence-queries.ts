import { EvidenceAttachment, EvidenceFileType } from "@/types";
import { SupabaseClient } from "@supabase/supabase-js";

const EVIDENCE_FILE_TYPES = new Set<EvidenceFileType>([
  "POD",
  "Contract",
  "Photo",
  "Invoice",
  "Other",
]);

type RawEvidenceRow = {
  id: string;
  ledger_id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  file_type: EvidenceFileType;
  uploaded_at: string;
};

function mapEvidenceRow(row: RawEvidenceRow): EvidenceAttachment {
  return {
    id: row.id,
    ledger_id: row.ledger_id,
    user_id: row.user_id,
    file_name: row.file_name,
    storage_path: row.storage_path,
    file_type: row.file_type,
    uploaded_at: row.uploaded_at,
  };
}

export function isEvidenceFileType(value: string): value is EvidenceFileType {
  return EVIDENCE_FILE_TYPES.has(value as EvidenceFileType);
}

export async function fetchEvidenceForLedger(
  supabase: SupabaseClient,
  userId: string,
  ledgerId: string
): Promise<EvidenceAttachment[]> {
  const { data, error } = await supabase
    .from("evidence_attachments")
    .select(
      "id, ledger_id, user_id, file_name, storage_path, file_type, uploaded_at"
    )
    .eq("ledger_id", ledgerId)
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load evidence attachments.");
  }

  return ((data ?? []) as RawEvidenceRow[]).map(mapEvidenceRow);
}

export async function fetchEvidenceAttachmentById(
  supabase: SupabaseClient,
  userId: string,
  ledgerId: string,
  attachmentId: string
): Promise<EvidenceAttachment | null> {
  const { data, error } = await supabase
    .from("evidence_attachments")
    .select(
      "id, ledger_id, user_id, file_name, storage_path, file_type, uploaded_at"
    )
    .eq("id", attachmentId)
    .eq("ledger_id", ledgerId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load evidence attachment.");
  }

  return data ? mapEvidenceRow(data as RawEvidenceRow) : null;
}