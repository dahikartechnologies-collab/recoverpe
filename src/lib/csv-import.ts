import { MappedImportRow } from "@/types";

export type ImportFieldKey =
  | "contact_name"
  | "phone_number"
  | "amount"
  | "due_date"
  | "invoice_number";

export const IMPORT_FIELD_LABELS: Record<ImportFieldKey, string> = {
  contact_name: "Contact Name",
  phone_number: "Phone Number",
  amount: "Amount",
  due_date: "Due Date",
  invoice_number: "Invoice Number",
};

export const REQUIRED_IMPORT_FIELDS: ImportFieldKey[] = [
  "contact_name",
  "phone_number",
  "amount",
  "due_date",
];

export const OPTIONAL_IMPORT_FIELDS: ImportFieldKey[] = ["invoice_number"];

const FIELD_HEURISTICS: Record<ImportFieldKey, string[]> = {
  contact_name: [
    "party name",
    "contact name",
    "customer name",
    "client name",
    "debtor name",
    "name",
    "party",
    "customer",
    "client",
    "account name",
  ],
  phone_number: [
    "phone number",
    "phone",
    "mobile",
    "mobile number",
    "contact number",
    "mob",
    "cell",
    "whatsapp",
  ],
  amount: [
    "amount",
    "bal",
    "balance",
    "balance due",
    "outstanding",
    "total",
    "total amount",
    "due amount",
    "invoice amount",
    "closing balance",
    "pending amount",
  ],
  due_date: [
    "due date",
    "due on",
    "payment due",
    "due",
    "expiry date",
    "bill date",
    "invoice date",
  ],
  invoice_number: [
    "invoice number",
    "invoice no",
    "invoice #",
    "bill number",
    "bill no",
    "voucher number",
    "voucher no",
    "inv no",
    "inv number",
    "reference number",
  ],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function guessColumnMapping(
  headers: string[]
): Partial<Record<ImportFieldKey, string>> {
  const mapping: Partial<Record<ImportFieldKey, string>> = {};
  const usedHeaders = new Set<string>();

  for (const field of REQUIRED_IMPORT_FIELDS) {
    const candidates = FIELD_HEURISTICS[field];

    const exactMatch = headers.find((header) => {
      const normalized = normalizeHeader(header);
      return candidates.includes(normalized) && !usedHeaders.has(header);
    });

    if (exactMatch) {
      mapping[field] = exactMatch;
      usedHeaders.add(exactMatch);
      continue;
    }

    const partialMatch = headers.find((header) => {
      const normalized = normalizeHeader(header);
      return (
        !usedHeaders.has(header) &&
        candidates.some(
          (candidate) =>
            normalized.includes(candidate) || candidate.includes(normalized)
        )
      );
    });

    if (partialMatch) {
      mapping[field] = partialMatch;
      usedHeaders.add(partialMatch);
    }
  }

  for (const field of OPTIONAL_IMPORT_FIELDS) {
    const candidates = FIELD_HEURISTICS[field];

    const exactMatch = headers.find((header) => {
      const normalized = normalizeHeader(header);
      return candidates.includes(normalized) && !usedHeaders.has(header);
    });

    if (exactMatch) {
      mapping[field] = exactMatch;
      usedHeaders.add(exactMatch);
      continue;
    }

    const partialMatch = headers.find((header) => {
      const normalized = normalizeHeader(header);
      return (
        !usedHeaders.has(header) &&
        candidates.some(
          (candidate) =>
            normalized.includes(candidate) || candidate.includes(normalized)
        )
      );
    });

    if (partialMatch) {
      mapping[field] = partialMatch;
      usedHeaders.add(partialMatch);
    }
  }

  return mapping;
}

export function isMappingComplete(
  mapping: Partial<Record<ImportFieldKey, string>>
): mapping is Record<ImportFieldKey, string> {
  return REQUIRED_IMPORT_FIELDS.every((field) => Boolean(mapping[field]?.trim()));
}

function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[,\s₹]/g, "").trim();

  if (!cleaned) {
    return null;
  }

  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseDueDate(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const ddmmyyyy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function normalizePhoneDigits(value: string): string | null {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) {
    return digits;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }

  return null;
}

export interface RowTransformResult {
  row: MappedImportRow | null;
  error: string | null;
}

export function transformCsvRow(
  rawRow: Record<string, string>,
  mapping: Partial<Record<ImportFieldKey, string>>,
  rowNumber: number
): RowTransformResult {
  const contactName = rawRow[mapping.contact_name ?? ""]?.trim() ?? "";
  const phoneRaw = rawRow[mapping.phone_number ?? ""]?.trim() ?? "";
  const amountRaw = rawRow[mapping.amount ?? ""]?.trim() ?? "";
  const dueDateRaw = rawRow[mapping.due_date ?? ""]?.trim() ?? "";
  const invoiceNumberRaw = mapping.invoice_number
    ? rawRow[mapping.invoice_number]?.trim() ?? ""
    : "";

  if (!contactName) {
    return { row: null, error: `Row ${rowNumber}: Contact name is missing.` };
  }

  const phoneDigits = normalizePhoneDigits(phoneRaw);
  if (!phoneDigits) {
    return {
      row: null,
      error: `Row ${rowNumber}: Phone number must be a valid 10-digit Indian mobile.`,
    };
  }

  const amount = parseAmount(amountRaw);
  if (amount === null) {
    return { row: null, error: `Row ${rowNumber}: Amount is invalid.` };
  }

  const dueDate = parseDueDate(dueDateRaw);
  if (!dueDate) {
    return { row: null, error: `Row ${rowNumber}: Due date is invalid.` };
  }

  return {
    row: {
      contact_name: contactName,
      phone_number: phoneDigits,
      amount,
      due_date: dueDate,
      invoice_number: invoiceNumberRaw || null,
    },
    error: null,
  };
}

export function transformCsvRows(
  rows: Record<string, string>[],
  mapping: Partial<Record<ImportFieldKey, string>>
): { validRows: MappedImportRow[]; errors: string[] } {
  if (!isMappingComplete(mapping)) {
    return { validRows: [], errors: ["Column mapping is incomplete."] };
  }

  const validRows: MappedImportRow[] = [];
  const errors: string[] = [];

  rows.forEach((rawRow, index) => {
    const result = transformCsvRow(rawRow, mapping, index + 2);

    if (result.row) {
      validRows.push(result.row);
    } else if (result.error) {
      errors.push(result.error);
    }
  });

  return { validRows, errors };
}

export const MAX_CSV_FILE_SIZE_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_FILE_SIZE_LABEL = "2 MB max";
export const CSV_IMPORT_BATCH_ROW_LIMIT = 500;
