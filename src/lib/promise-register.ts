import { SupabaseClient } from "@supabase/supabase-js";
import {
  getDefaultGeminiModel,
  getVertexAI,
} from "@/lib/firebase-admin-vertexai";
import { canRecordInboundPromise } from "@/lib/business-addons";
import { retryAsync } from "@/lib/resilient-fetch";
import { getTodayDateStringInIst } from "@/lib/timezone";
import {
  BusinessDebtScope,
  LedgerSummaryEntry,
} from "@/lib/whatsapp/inbound-payment-responder";

const PROMISE_EXTRACTION_PROMPT = `You extract verbal payment promises from debtor WhatsApp messages.

Given the customer message and ledger context, decide if they committed to pay by a specific date.
Examples: "Friday", "kal dunga", "next week", "₹5000 on 20th", "will pay tomorrow".

Return ONLY valid JSON:
{
  "has_promise": boolean,
  "promised_date": "YYYY-MM-DD" | null,
  "promised_amount": number | null
}

Rules:
- Resolve relative dates against the supplied IST reference date.
- promised_date must be today or in the future; null if unclear.
- promised_amount: best estimate from message or primary open balance; null if not stated.
- has_promise is false for vague intent ("will try", "maybe") with no date.`;

export interface PaymentPromiseExtraction {
  has_promise: boolean;
  promised_date: string | null;
  promised_amount: number | null;
}

export function parsePaymentPromiseExtraction(
  raw: string
): PaymentPromiseExtraction | null {
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as
      | Record<string, unknown>
      | null;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const promisedDate =
      typeof parsed.promised_date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.promised_date)
        ? parsed.promised_date
        : null;

    const amount = Number(parsed.promised_amount);

    return {
      has_promise: parsed.has_promise === true,
      promised_date: promisedDate,
      promised_amount: Number.isFinite(amount) && amount >= 0 ? amount : null,
    };
  } catch {
    return null;
  }
}

export function buildPromiseExtractionPrompt(
  messageText: string,
  ledgerSummaryData: LedgerSummaryEntry[],
  referenceDateIst: string
): string {
  return `${PROMISE_EXTRACTION_PROMPT}

IST reference date (today): ${referenceDateIst}

Ledger context:
${JSON.stringify(ledgerSummaryData, null, 2)}

Customer message:
${messageText}`;
}

export async function extractPaymentPromiseFromMessage(
  messageText: string,
  ledgerSummaryData: LedgerSummaryEntry[],
  referenceDateIst = getTodayDateStringInIst()
): Promise<PaymentPromiseExtraction | null> {
  const modelId = getDefaultGeminiModel();

  try {
    const prompt = buildPromiseExtractionPrompt(
      messageText,
      ledgerSummaryData,
      referenceDateIst
    );

    const result = await retryAsync(
      () =>
        getVertexAI()
          .getGenerativeModel({ model: modelId })
          .generateContent(prompt, {
            responseMimeType: "application/json",
            temperature: 0,
          }),
      { scope: "VERTEX PROMISE", maxAttempts: 2, baseDelayMs: 600 }
    );

    const raw = result.response.text().trim();
    return parsePaymentPromiseExtraction(raw);
  } catch (error) {
    console.error(
      "[PROMISE REGISTER] Extraction failed:",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

function resolvePromiseAmount(
  extraction: PaymentPromiseExtraction,
  scope: BusinessDebtScope
): number {
  if (extraction.promised_amount !== null && extraction.promised_amount > 0) {
    return extraction.promised_amount;
  }

  const total = scope.unpaidLedgers.reduce(
    (sum, ledger) => sum + Number(ledger.balance_due ?? 0),
    0
  );

  return Math.max(0, Math.round(total * 100) / 100);
}

export async function recordInboundPaymentPromise(
  supabase: SupabaseClient,
  scope: BusinessDebtScope,
  extraction: PaymentPromiseExtraction,
  communicationLogId: string | null
): Promise<boolean> {
  if (
    !extraction.has_promise ||
    !extraction.promised_date ||
    extraction.promised_date < getTodayDateStringInIst()
  ) {
    return false;
  }

  if (!(await canRecordInboundPromise(supabase, scope.businessId))) {
    console.log(
      "[PROMISE REGISTER] Free-tier open promise cap reached for business:",
      scope.businessId
    );
    return false;
  }

  const promisedAmount = resolvePromiseAmount(extraction, scope);
  const primaryLedgerId = scope.unpaidLedgers[0]?.id ?? null;

  const { error } = await supabase.from("payment_promises").insert({
    user_id: scope.contact.user_id,
    business_id: scope.businessId,
    contact_id: scope.contact.id,
    ledger_id: primaryLedgerId,
    promised_on: extraction.promised_date,
    promised_amount: promisedAmount,
    source: "inbound",
    status: "open",
    communication_log_id: communicationLogId,
  });

  if (error) {
    console.error("[PROMISE REGISTER] Insert failed:", error.message);
    return false;
  }

  return true;
}

export async function markBrokenPromisesAfterMidnight(
  supabase: SupabaseClient,
  todayIst = getTodayDateStringInIst()
): Promise<number> {
  const { data, error } = await supabase
    .from("payment_promises")
    .update({ status: "broken" })
    .eq("status", "open")
    .lt("promised_on", todayIst)
    .select("id");

  if (error) {
    throw new Error(error.message || "Failed to mark broken promises.");
  }

  return data?.length ?? 0;
}

export async function tryExtractAndRecordPaymentPromises(
  supabase: SupabaseClient,
  scopes: BusinessDebtScope[],
  messageText: string,
  ledgerSummaryData: LedgerSummaryEntry[],
  communicationLogIds: Map<string, string | null>
): Promise<number> {
  const extraction = await extractPaymentPromiseFromMessage(
    messageText,
    ledgerSummaryData
  );

  if (!extraction?.has_promise) {
    return 0;
  }

  let recorded = 0;

  for (const scope of scopes) {
    if (scope.contact.bot_paused) {
      continue;
    }

    const logId =
      communicationLogIds.get(scope.contact.id) ??
      communicationLogIds.get(`${scope.contact.id}:${scope.businessId ?? "personal"}`) ??
      null;

    const inserted = await recordInboundPaymentPromise(
      supabase,
      scope,
      extraction,
      logId
    );

    if (inserted) {
      recorded += 1;
    }
  }

  return recorded;
}
