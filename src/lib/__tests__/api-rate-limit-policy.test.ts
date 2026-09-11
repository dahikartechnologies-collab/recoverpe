import { describe, expect, it } from "vitest";
import { shouldSkipGlobalApiRateLimit } from "@/lib/api-rate-limit-policy";

function requestWithAuth(authorization?: string): Request {
  const headers = new Headers();

  if (authorization) {
    headers.set("authorization", authorization);
  }

  return new Request("https://recoverpe.test/api/dashboard/home", { headers });
}

describe("shouldSkipGlobalApiRateLimit", () => {
  it("skips Redis for authenticated dashboard APIs", () => {
    expect(
      shouldSkipGlobalApiRateLimit(
        "/api/dashboard/home",
        requestWithAuth(`Bearer ${"x".repeat(48)}`)
      )
    ).toBe(true);
  });

  it("keeps Redis on webhooks even if a bearer token is present", () => {
    expect(
      shouldSkipGlobalApiRateLimit(
        "/api/webhooks/whatsapp",
        requestWithAuth(`Bearer ${"x".repeat(48)}`)
      )
    ).toBe(false);
  });

  it("keeps Redis on public and pay APIs", () => {
    expect(
      shouldSkipGlobalApiRateLimit("/api/public/onboard", requestWithAuth())
    ).toBe(false);
    expect(
      shouldSkipGlobalApiRateLimit("/api/pay/abc", requestWithAuth())
    ).toBe(false);
  });

  it("keeps Redis when there is no bearer token", () => {
    expect(
      shouldSkipGlobalApiRateLimit("/api/dashboard/home", requestWithAuth())
    ).toBe(false);
  });
});
