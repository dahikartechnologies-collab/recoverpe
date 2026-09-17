import { isDevelopmentAppEnv } from "@/lib/app-env";
import { formatCurrency } from "@/lib/gst";
import { getTraiCurfewMessage, isTraiCurfewActive } from "@/lib/trai-curfew";

export class VapiClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VapiClientError";
  }
}

export class TraiCurfewError extends Error {
  constructor() {
    super(getTraiCurfewMessage());
    this.name = "TraiCurfewError";
  }
}

export interface VapiOutboundCallInput {
  ledgerId: string;
  contactId: string;
  businessId: string;
  userId: string;
  businessName: string;
  debtorName: string;
  debtorPhone: string;
  balanceDue: number;
}

export interface VapiOutboundCallResult {
  success: boolean;
  simulated: boolean;
  message: string;
  vapiCallId: string | null;
  payload: Record<string, unknown>;
}

function resolveVapiPrivateKey(): string {
  return (
    process.env.VAPI_PRIVATE_KEY?.trim() ||
    process.env.VAPI_API_KEY?.trim() ||
    ""
  );
}

function normalizePhoneNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.startsWith("91") && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  return digits.startsWith("+") ? digits : `+${digits}`;
}

export function buildRecoveryAssistantSystemPrompt(input: {
  businessName: string;
  debtorName: string;
  balanceDue: number;
}): string {
  const balanceLabel = formatCurrency(input.balanceDue);

  return [
    `You are an AI recovery assistant representing ${input.businessName}.`,
    `The customer ${input.debtorName} has a pending balance of ${balanceLabel}.`,
    "Speak in polite, professional Indian Hindi or English (Hinglish). Do not sound robotic.",
    "If they promise to pay, thank them and mention a payment link is in their WhatsApp.",
    "Keep responses under 2 sentences.",
  ].join(" ");
}

export function buildVapiOutboundCallPayload(
  input: VapiOutboundCallInput
): Record<string, unknown> {
  const assistantId = process.env.VAPI_ASSISTANT_ID?.trim() ?? "";
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim() ?? "";
  const balanceDueLabel = formatCurrency(input.balanceDue);
  const systemPrompt = buildRecoveryAssistantSystemPrompt({
    businessName: input.businessName,
    debtorName: input.debtorName,
    balanceDue: input.balanceDue,
  });

  const voiceProvider = process.env.VAPI_VOICE_PROVIDER?.trim() || "deepgram";
  const voiceId = process.env.VAPI_VOICE_ID?.trim() || "nova";

  return {
    assistantId,
    phoneNumberId,
    customer: {
      number: normalizePhoneNumber(input.debtorPhone),
      name: input.debtorName,
    },
    assistantOverrides: {
      variableValues: {
        businessName: input.businessName,
        debtorName: input.debtorName,
        balanceDue: balanceDueLabel,
      },
      firstMessage: `Namaste ${input.debtorName}, main ${input.businessName} ki taraf se bol rahi hoon. Aapka ${balanceDueLabel} baaki hai — kya aaj payment arrange ho sakta hai?`,
      model: {
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
        ],
      },
      voice: {
        provider: voiceProvider,
        voiceId,
      },
    },
    metadata: {
      ledger_id: input.ledgerId,
      contact_id: input.contactId,
      business_id: input.businessId,
      recoverpe_user_id: input.userId,
    },
  };
}

export async function createVapiOutboundCall(
  input: VapiOutboundCallInput
): Promise<VapiOutboundCallResult> {
  if (isTraiCurfewActive()) {
    throw new TraiCurfewError();
  }

  const payload = buildVapiOutboundCallPayload(input);

  if (isDevelopmentAppEnv()) {
    console.log("[Recoverpe VAPI Outbound Dev Bypass]", {
      ledger_id: input.ledgerId,
      contact_id: input.contactId,
      payload,
    });

    return {
      success: true,
      simulated: true,
      message: "AI voice call simulated in development mode.",
      vapiCallId: `dev_simulated_${input.ledgerId}`,
      payload,
    };
  }

  const apiKey = resolveVapiPrivateKey();
  const assistantId = payload.assistantId as string;
  const phoneNumberId = payload.phoneNumberId as string;

  if (!apiKey) {
    throw new VapiClientError(
      "VAPI_PRIVATE_KEY is not configured for production calls."
    );
  }

  if (!assistantId || !phoneNumberId) {
    throw new VapiClientError(
      "VAPI assistant and phone number IDs are not configured."
    );
  }

  const response = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new VapiClientError(`VAPI API failed: ${errorBody}`);
  }

  const result = (await response.json()) as { id?: string };

  return {
    success: true,
    simulated: false,
    message: "AI voice call initiated successfully.",
    vapiCallId: result.id ?? null,
    payload,
  };
}
