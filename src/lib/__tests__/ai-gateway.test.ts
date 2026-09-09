import { afterEach, describe, expect, it, vi } from "vitest";
import { executeAICompletion } from "@/lib/ai/gateway";

describe("executeAICompletion", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a deterministic dev fixture without deducting credits", async () => {
    vi.stubEnv("APP_ENV", "development");

    const result = await executeAICompletion(
      "Summarize debtor behavior for contact ABC",
      "business-123"
    );

    expect(result.simulated).toBe(true);
    expect(result.credits_remaining).toBeNull();

    const parsed = JSON.parse(result.content) as {
      mode: string;
      prompt_preview: string;
    };

    expect(parsed.mode).toBe("development_fixture");
    expect(parsed.prompt_preview).toContain("Summarize debtor");
  });
});
