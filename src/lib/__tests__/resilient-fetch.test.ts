import { afterEach, describe, expect, it, vi } from "vitest";
import { resilientFetch, retryAsync } from "@/lib/resilient-fetch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("resilientFetch", () => {
  it("returns a 2xx response on the first attempt", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await resilientFetch("https://example.com", { method: "GET" });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 4xx that is not 408 or 429", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("bad", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await resilientFetch("https://example.com");

    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx then returns the successful attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await resilientFetch(
      "https://example.com",
      {},
      { baseDelayMs: 1, maxAttempts: 3 }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("retryAsync", () => {
  it("retries a thrown error then succeeds", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce("done");

    await expect(
      retryAsync(operation, { maxAttempts: 3, baseDelayMs: 1 })
    ).resolves.toBe("done");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("throws the last error after exhausting attempts", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("still down"));

    await expect(
      retryAsync(operation, { maxAttempts: 2, baseDelayMs: 1 })
    ).rejects.toThrow("still down");
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
