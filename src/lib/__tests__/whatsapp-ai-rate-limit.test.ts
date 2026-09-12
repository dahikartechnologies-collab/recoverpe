import { describe, expect, it } from "vitest";
import {
  WHATSAPP_AI_INFERENCE_LIMIT,
  WHATSAPP_AI_VISION_INFERENCE_LIMIT,
  whatsAppAiRateLimitKey,
} from "@/lib/rate-limit";

describe("whatsAppAiRateLimitKey", () => {
  it("collapses +91, 91, and 0 prefixes to the last 10 digits", () => {
    expect(whatsAppAiRateLimitKey("919876543210")).toBe("9876543210");
    expect(whatsAppAiRateLimitKey("+91 98765 43210")).toBe("9876543210");
    expect(whatsAppAiRateLimitKey("09876543210")).toBe("9876543210");
  });

  it("does not invent a key from empty input", () => {
    expect(whatsAppAiRateLimitKey("")).toBe("unknown");
  });

  it("splits text and vision hourly budgets", () => {
    expect(WHATSAPP_AI_INFERENCE_LIMIT).toBe(20);
    expect(WHATSAPP_AI_VISION_INFERENCE_LIMIT).toBe(6);
  });
});
