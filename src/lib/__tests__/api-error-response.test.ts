import { afterEach, describe, expect, it, vi } from "vitest";
import { getSafeApiErrorMessage } from "@/lib/api-error-response";

describe("getSafeApiErrorMessage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("never returns schema strings to the client", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(
      getSafeApiErrorMessage(
        new Error('relation "ledgers" does not exist'),
        "Request failed."
      )
    ).toBe("Request failed.");
    expect(
      getSafeApiErrorMessage(
        new Error("column communication_logs.message_body does not exist"),
        "Request failed."
      )
    ).toBe("Request failed.");
  });

  it("strips all exception text in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(
      getSafeApiErrorMessage(new Error("Failed to lock Razorpay order."), "Request failed.")
    ).toBe("Request failed.");
  });

  it("keeps free-plan upgrade copy", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(
      getSafeApiErrorMessage(
        new Error("Free plan is limited to 15 invoices. Upgrade to a paid plan to add more."),
        "Request failed."
      )
    ).toContain("Free plan");
  });
});
