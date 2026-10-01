import { ResponseSchema, SchemaType } from "@google-cloud/vertexai";
import { generateStructuredJson } from "@/lib/smart-stocks/vertex";
import {
  normalizeParchiExtraction,
  ParchiExtraction,
} from "@/lib/smart-stocks/shared";

export { normalizeParchiExtraction } from "@/lib/smart-stocks/shared";
export type { ParchiExtraction, ParchiLineItem } from "@/lib/smart-stocks/shared";

export const SMART_STOCKS_BUCKET = "smart_stocks_documents";
export const PARCHI_MAX_BYTES = 4 * 1024 * 1024;
export const PARCHI_DEFAULT_CONFIDENCE = 0.95;
export const PARCHI_SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const PARCHI_RESPONSE_SCHEMA: ResponseSchema = {
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

export function isAllowedParchiMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

/** Recovers the object path from a stored signed URL so it can be re-signed. */
export function storagePathFromSignedUrl(url: string): string | null {
  const marker = `/object/sign/${SMART_STOCKS_BUCKET}/`;
  const start = url.indexOf(marker);

  if (start === -1) {
    return null;
  }

  const rest = url.slice(start + marker.length);
  const path = rest.split("?")[0];

  return path ? decodeURIComponent(path) : null;
}

export async function extractParchiWithGemini(input: {
  imageBase64: string;
  mimeType: string;
}): Promise<ParchiExtraction> {
  const parsed = await generateStructuredJson(PARCHI_RESPONSE_SCHEMA, [
    { text: PARCHI_PROMPT },
    {
      inlineData: {
        mimeType: input.mimeType,
        data: input.imageBase64,
      },
    },
  ]);

  return normalizeParchiExtraction(parsed);
}
