import {
  GoogleGenerativeAI,
  ObjectSchema,
  SchemaType,
} from "@google/generative-ai";

export const PARCHI_READER_MODEL = "gemini-3.5-flash";
export const SMART_STOCKS_BUCKET = "smart_stocks_documents";
export const PARCHI_MAX_BYTES = 4 * 1024 * 1024;
export const PARCHI_DEFAULT_CONFIDENCE = 0.95;
export const PARCHI_SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const PARCHI_RESPONSE_SCHEMA: ObjectSchema = {
  type: SchemaType.OBJECT,
  properties: {
    supplier_name: { type: SchemaType.STRING },
    bill_date: {
      type: SchemaType.STRING,
      description: "Bill date in ISO format, YYYY-MM-DD.",
    },
    credit_amount: { type: SchemaType.NUMBER },
    line_items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          description: { type: SchemaType.STRING },
          qty: { type: SchemaType.NUMBER },
          rate: { type: SchemaType.NUMBER },
          amount: { type: SchemaType.NUMBER },
        },
        required: ["description", "qty", "rate", "amount"],
      },
    },
  },
  required: ["supplier_name", "bill_date", "credit_amount", "line_items"],
};

const PARCHI_PROMPT = [
  "You are an expert Indian accountant.",
  "Read the handwritten or printed supplier challan or invoice in the image.",
  "Extract the supplier name, the bill date as an ISO date (YYYY-MM-DD), the total amount payable on credit, and every line item.",
  "Each line item needs the description, quantity, rate, and line amount exactly as written.",
  "Do not invent rows that are not on the document.",
  "If a number is unreadable, use 0. If a name or description is unreadable, use an empty string.",
].join(" ");

export interface ParchiLineItem {
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface ParchiExtraction {
  supplier_name: string;
  bill_date: string;
  credit_amount: number;
  line_items: ParchiLineItem[];
}

export function isAllowedParchiMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

function asFiniteNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function asIsoDate(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  const isoDay = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);

  if (isoDay) {
    return isoDay[1];
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }

  return parsed.toISOString().slice(0, 10);
}

export function normalizeParchiExtraction(value: unknown): ParchiExtraction {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawLines = Array.isArray(record.line_items) ? record.line_items : [];

  return {
    supplier_name:
      typeof record.supplier_name === "string" ? record.supplier_name.trim() : "",
    bill_date: asIsoDate(record.bill_date),
    credit_amount: asFiniteNumber(record.credit_amount),
    line_items: rawLines.map((line) => {
      const item =
        line && typeof line === "object" ? (line as Record<string, unknown>) : {};

      return {
        description:
          typeof item.description === "string" ? item.description.trim() : "",
        qty: asFiniteNumber(item.qty),
        rate: asFiniteNumber(item.rate),
        amount: asFiniteNumber(item.amount),
      };
    }),
  };
}

export async function extractParchiWithGemini(input: {
  imageBase64: string;
  mimeType: string;
}): Promise<ParchiExtraction> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Add it to the server environment before reading parchis."
    );
  }

  const modelName = process.env.GEMINI_MODEL?.trim() || PARCHI_READER_MODEL;
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: PARCHI_RESPONSE_SCHEMA,
    },
  });

  const result = await model.generateContent([
    { text: PARCHI_PROMPT },
    {
      inlineData: {
        mimeType: input.mimeType,
        data: input.imageBase64,
      },
    },
  ]);

  const text = result.response.text()?.trim();

  if (!text) {
    throw new Error("Gemini returned an empty parchi reading.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini did not return valid JSON for the parchi.");
  }

  return normalizeParchiExtraction(parsed);
}
