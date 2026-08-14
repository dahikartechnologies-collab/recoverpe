import { formatCurrency } from "@/lib/gst";
import { Business, LedgerWithContact } from "@/types";

export const VAPI_CALL_CREDIT_COST = 3;

export interface VapiCallContext {
  business_name: string;
  debtor_name: string;
  balance_due: number;
  balance_due_label: string;
  days_overdue: number;
  due_date: string;
  invoice_number: string | null;
  ledger_id: string;
}

export interface VapiCallDraft {
  ledger_id: string;
  customer_number: string;
  context: VapiCallContext;
  system_prompt: string;
  first_message: string;
  vapi_payload: VapiOutboundCallPayload;
}

export interface VapiOutboundCallPayload {
  assistantId: string;
  phoneNumberId: string;
  customer: {
    number: string;
    name: string;
  };
  assistantOverrides: {
    variableValues: VapiCallContext;
    firstMessage: string;
    model: {
      messages: Array<{
        role: "system";
        content: string;
      }>;
    };
  };
  metadata: {
    ledger_id: string;
    recoverpe_user_id: string;
  };
}

export interface VapiSendResult {
  success: boolean;
  simulated: boolean;
  message: string;
  draft: VapiCallDraft;
  vapi_call_id?: string;
}

interface DraftVapiCallInput {
  ledger: LedgerWithContact;
  business: Pick<Business, "business_name"> | null;
  userId: string;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function calculateDaysOverdue(
  dueDate: string,
  referenceDate: string = new Date().toISOString().slice(0, 10)
): number {
  const due = parseDateOnly(dueDate);
  const today = parseDateOnly(referenceDate);
  const millisecondsPerDay = 1000 * 60 * 60 * 24;

  return Math.max(
    0,
    Math.round((today.getTime() - due.getTime()) / millisecondsPerDay)
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

function resolveBusinessName(
  ledger: LedgerWithContact,
  business: Pick<Business, "business_name"> | null
): string {
  if (business?.business_name) {
    return business.business_name;
  }

  return ledger.business_id ? "Recoverpe Business" : "Recoverpe Personal";
}

export function buildSnehaSystemPrompt(context: VapiCallContext): string {
  const invoiceLine = context.invoice_number
    ? ` regarding invoice ${context.invoice_number}`
    : "";

  return [
    "You are Sneha, Recoverpe's professional AI recovery agent.",
    `You are calling on behalf of ${context.business_name}.`,
    `The person you are speaking with is ${context.debtor_name}.`,
    `They have an outstanding balance of ${context.balance_due_label}${invoiceLine}.`,
    `The payment was due on ${context.due_date} and is now ${context.days_overdue} day(s) overdue.`,
    "Be polite, empathetic, and firm. Confirm whether they can pay today or propose a realistic payment date.",
    "Do not threaten legal action. Keep the conversation concise and professional.",
  ].join(" ");
}

export function buildSnehaFirstMessage(context: VapiCallContext): string {
  return `Hello ${context.debtor_name}, this is Sneha calling from ${context.business_name}. I'm reaching out about your pending balance of ${context.balance_due_label}. Do you have a moment to discuss payment?`;
}

export function draftVapiCall({
  ledger,
  business,
  userId,
}: DraftVapiCallInput): VapiCallDraft {
  const assistantId = process.env.VAPI_ASSISTANT_ID ?? "";
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID ?? "";
  const businessName = resolveBusinessName(ledger, business);
  const daysOverdue = calculateDaysOverdue(ledger.due_date);
  const balanceDueLabel = formatCurrency(ledger.balance_due);

  const context: VapiCallContext = {
    business_name: businessName,
    debtor_name: ledger.contact.name,
    balance_due: ledger.balance_due,
    balance_due_label: balanceDueLabel,
    days_overdue: daysOverdue,
    due_date: ledger.due_date,
    invoice_number: ledger.invoice_number,
    ledger_id: ledger.id,
  };

  const system_prompt = buildSnehaSystemPrompt(context);
  const first_message = buildSnehaFirstMessage(context);
  const customer_number = normalizePhoneNumber(ledger.contact.phone_number);

  const vapi_payload: VapiOutboundCallPayload = {
    assistantId,
    phoneNumberId,
    customer: {
      number: customer_number,
      name: ledger.contact.name,
    },
    assistantOverrides: {
      variableValues: context,
      firstMessage: first_message,
      model: {
        messages: [
          {
            role: "system",
            content: system_prompt,
          },
        ],
      },
    },
    metadata: {
      ledger_id: ledger.id,
      recoverpe_user_id: userId,
    },
  };

  return {
    ledger_id: ledger.id,
    customer_number,
    context,
    system_prompt,
    first_message,
    vapi_payload,
  };
}

export async function initiateVapiOutboundCall(
  draft: VapiCallDraft
): Promise<VapiSendResult> {
  const isDevelopment = process.env.NEXT_PUBLIC_APP_ENV === "development";

  if (isDevelopment) {
    console.log("[Recoverpe VAPI Dev Bypass]", {
      environment: process.env.NEXT_PUBLIC_APP_ENV,
      ledger_id: draft.ledger_id,
      customer_number: draft.customer_number,
      context: draft.context,
      system_prompt: draft.system_prompt,
      first_message: draft.first_message,
      vapi_payload: draft.vapi_payload,
    });

    return {
      success: true,
      simulated: true,
      message: "AI voice call simulated in development mode.",
      draft,
      vapi_call_id: `dev_simulated_${draft.ledger_id}`,
    };
  }

  const apiKey = process.env.VAPI_API_KEY;

  if (!apiKey) {
    throw new Error("VAPI API credentials are not configured for production calls.");
  }

  if (!draft.vapi_payload.assistantId || !draft.vapi_payload.phoneNumberId) {
    throw new Error(
      "VAPI assistant and phone number IDs are not configured for production calls."
    );
  }

  const response = await fetch("https://api.vapi.ai/call/phone", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(draft.vapi_payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`VAPI API failed: ${errorBody}`);
  }

  const result = (await response.json()) as { id?: string };

  return {
    success: true,
    simulated: false,
    message: "AI voice call initiated successfully.",
    draft,
    vapi_call_id: result.id,
  };
}
