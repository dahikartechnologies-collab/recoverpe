import { isDevelopmentAppEnv } from "@/lib/app-env";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export class InsufficientAICreditsError extends Error {
  readonly code = "INSUFFICIENT_AI_CREDITS";

  constructor(message = "No AI credits remaining for this business.") {
    super(message);
    this.name = "InsufficientAICreditsError";
  }
}

export class AIGatewayExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIGatewayExecutionError";
  }
}

export interface AICompletionResult {
  content: string;
  simulated: boolean;
  credits_remaining: number | null;
}

interface DevFixtureResponse {
  mode: "development_fixture";
  summary: string;
  prompt_preview: string;
  generated_at: string;
}

function buildDevFixture(prompt: string): DevFixtureResponse {
  return {
    mode: "development_fixture",
    summary:
      "Deterministic dev fixture. No LLM provider invoked and no credits deducted.",
    prompt_preview: prompt.trim().slice(0, 160),
    generated_at: new Date().toISOString(),
  };
}

async function deductBusinessAiCredit(businessId: string): Promise<number> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("deduct_business_ai_credit", {
    p_business_id: businessId,
  });

  if (error) {
    throw new AIGatewayExecutionError(
      error.message || "Failed to reserve AI credit."
    );
  }

  if (data === null || data === undefined) {
    throw new InsufficientAICreditsError();
  }

  return Number(data);
}

async function refundBusinessAiCredit(businessId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.rpc("refund_business_ai_credit", {
    p_business_id: businessId,
  });

  if (error) {
    console.error(
      `[AI Gateway] Failed to refund credit for business ${businessId}:`,
      error.message
    );
  }
}

/**
 * Centralized AI adapter. UI components must never call LLM SDKs directly.
 * v1 uses deterministic fixtures in development; production deducts ai_credits
 * atomically and returns a structured placeholder until an LLM provider is wired.
 */
export async function executeAICompletion(
  prompt: string,
  businessId: string
): Promise<AICompletionResult> {
  const trimmedPrompt = prompt.trim();
  const trimmedBusinessId = businessId.trim();

  if (!trimmedPrompt) {
    throw new AIGatewayExecutionError("prompt is required.");
  }

  if (!trimmedBusinessId) {
    throw new AIGatewayExecutionError("businessId is required.");
  }

  if (isDevelopmentAppEnv()) {
    const fixture = buildDevFixture(trimmedPrompt);

    console.log("[Recoverpe AI Gateway Dev Bypass]", {
      business_id: trimmedBusinessId,
      prompt_length: trimmedPrompt.length,
      fixture,
    });

    return {
      content: JSON.stringify(fixture),
      simulated: true,
      credits_remaining: null,
    };
  }

  const creditsRemaining = await deductBusinessAiCredit(trimmedBusinessId);

  try {
    // LLM provider integration lands in a future sprint. Keep spend at ₹0 for v1.
    const placeholder = {
      mode: "gateway_placeholder",
      message:
        "AI gateway credit reserved. LLM provider integration is not configured yet.",
      prompt_length: trimmedPrompt.length,
    };

    return {
      content: JSON.stringify(placeholder),
      simulated: false,
      credits_remaining: creditsRemaining,
    };
  } catch (error) {
    await refundBusinessAiCredit(trimmedBusinessId);
    throw error;
  }
}
