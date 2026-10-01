import { ResponseSchema, SchemaType } from "@google-cloud/vertexai";
import {
  normalizeVoiceCommand,
  VOICE_INTENTS,
  VoiceParsedCommand,
} from "@/lib/smart-stocks/shared";
import { generateStructuredJson } from "@/lib/smart-stocks/vertex";

const MAX_ITEM_HINTS = 200;

const VOICE_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    intent: {
      type: SchemaType.STRING,
      enum: [...VOICE_INTENTS],
    },
    customer_name: { type: SchemaType.STRING, nullable: true },
    customer_phone: {
      type: SchemaType.STRING,
      nullable: true,
      description: "Digits only, 10-digit Indian mobile number.",
    },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          qty: { type: SchemaType.NUMBER },
          unit_price: { type: SchemaType.NUMBER, nullable: true },
        },
        required: ["name", "qty"],
      },
    },
    notes: { type: SchemaType.STRING },
  },
  required: ["intent", "customer_name", "customer_phone", "items", "notes"],
};

function buildVoicePrompt(transcript: string, itemNames: string[]): string {
  const hints = itemNames.slice(0, MAX_ITEM_HINTS);

  return [
    "You are the billing assistant at an Indian kirana or wholesale shop.",
    "The shopkeeper spoke the command below in Hindi, Hinglish or Indian English.",
    "Classify the intent:",
    '- "sale": goods given to a customer, including on credit (udhaar, khate mein likho, de diya, becha).',
    '- "adjustment_loss": stock lost, damaged, expired or used up (toot gaya, kharab, expire, chori).',
    '- "purchase": goods received from a supplier (maal aaya, kharida, supplier se liya).',
    "Convert spoken Hindi numbers to digits (ek=1, do=2, teen=3, char=4, paanch=5, das=10, bees=20, pachaas=50, sau=100, aadha=0.5, dedh=1.5, dhai=2.5).",
    "unit_price is the price per unit only if it was spoken; otherwise null. Never invent prices.",
    "customer_name and customer_phone are null unless spoken. Phone is digits only.",
    hints.length > 0
      ? `When an item clearly refers to one of the shop's stock items, use that exact stock item name: ${JSON.stringify(hints)}.`
      : "Use the item names as spoken.",
    "notes holds anything else useful, in short English. Use an empty string if there is nothing.",
    "",
    `Command: ${JSON.stringify(transcript)}`,
  ].join("\n");
}

export async function parseVoiceCommandWithGemini(
  transcript: string,
  itemNames: string[]
): Promise<VoiceParsedCommand> {
  const parsed = await generateStructuredJson(VOICE_RESPONSE_SCHEMA, [
    { text: buildVoicePrompt(transcript, itemNames) },
  ]);

  return normalizeVoiceCommand(parsed);
}
