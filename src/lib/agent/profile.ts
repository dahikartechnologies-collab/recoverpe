import { SupabaseClient } from "@supabase/supabase-js";
import {
  AgentKycDocuments,
  KycDocumentSide,
  parseAgentKycDocuments,
  serializeAgentKycDocuments,
  uploadAgentKycDocument,
} from "@/lib/agent/kyc-storage";

export interface AgentProfileRow {
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  kyc_document_url: string | null;
  status: string;
}

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export function normalizeIfsc(value: string): string {
  return value.trim().toUpperCase();
}

export function validateBankProfile(input: {
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
}): {
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc: string;
} {
  const bankAccountName = input.bankAccountName?.trim() ?? "";
  const bankAccountNumber = input.bankAccountNumber?.replace(/\s/g, "") ?? "";
  const bankIfsc = normalizeIfsc(input.bankIfsc ?? "");

  if (!bankAccountName || bankAccountName.length < 2) {
    throw new Error("Enter the bank account holder name.");
  }

  if (!/^\d{9,18}$/.test(bankAccountNumber)) {
    throw new Error("Enter a valid bank account number.");
  }

  if (!IFSC_PATTERN.test(bankIfsc)) {
    throw new Error("Enter a valid IFSC code.");
  }

  return {
    bank_account_name: bankAccountName,
    bank_account_number: bankAccountNumber,
    bank_ifsc: bankIfsc,
  };
}

export async function updateAgentBankProfile(
  supabase: SupabaseClient,
  agentId: string,
  input: {
    bankAccountName: string;
    bankAccountNumber: string;
    bankIfsc: string;
  }
): Promise<AgentProfileRow> {
  const bank = validateBankProfile(input);

  const { data, error } = await supabase
    .from("agents")
    .update(bank)
    .eq("id", agentId)
    .select(
      "bank_account_name, bank_account_number, bank_ifsc, kyc_document_url, status"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to save bank profile.");
  }

  return data as AgentProfileRow;
}

export async function uploadAgentKycSide(
  supabase: SupabaseClient,
  agentId: string,
  side: KycDocumentSide,
  file: {
    fileName: string;
    fileBuffer: Buffer;
    contentType: string;
  }
): Promise<AgentProfileRow> {
  const { data: existing, error: existingError } = await supabase
    .from("agents")
    .select("kyc_document_url, status")
    .eq("id", agentId)
    .single();

  if (existingError || !existing) {
    throw new Error(existingError?.message || "Agent profile not found.");
  }

  const storagePath = await uploadAgentKycDocument({
    agentId,
    side,
    fileName: file.fileName,
    fileBuffer: file.fileBuffer,
    contentType: file.contentType,
  });

  const documents: AgentKycDocuments = {
    ...parseAgentKycDocuments(existing.kyc_document_url as string | null),
    [side]: storagePath,
  };

  const update: Record<string, unknown> = {
    kyc_document_url: serializeAgentKycDocuments(documents),
  };

  if ((existing.status as string) !== "active") {
    update.status = "pending_kyc";
  }

  const { data, error } = await supabase
    .from("agents")
    .update(update)
    .eq("id", agentId)
    .select(
      "bank_account_name, bank_account_number, bank_ifsc, kyc_document_url, status"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to save KYC document.");
  }

  return data as AgentProfileRow;
}
