import { describe, expect, it } from "vitest";
import { isPremiumBusiness } from "@/lib/workspace-rbac";

describe("isPremiumBusiness", () => {
  it("returns true only when subscription_tier is premium", () => {
    expect(isPremiumBusiness({ subscription_tier: "premium" })).toBe(true);
    expect(isPremiumBusiness({ subscription_tier: "free" })).toBe(false);
    expect(isPremiumBusiness(null)).toBe(false);
    expect(isPremiumBusiness(undefined)).toBe(false);
  });
});
