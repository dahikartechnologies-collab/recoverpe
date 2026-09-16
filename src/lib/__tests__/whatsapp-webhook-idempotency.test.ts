import { beforeEach, describe, expect, it, vi } from "vitest";

const redisState = vi.hoisted(() => ({
  set: vi.fn(),
}));

vi.mock("@upstash/redis/cloudflare", () => ({
  Redis: class {
    set = redisState.set;
  },
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: (work: Promise<unknown>) => {
    void work;
  },
}));

import {
  claimWhatsAppWamid,
  whatsAppWamidKey,
} from "@/lib/whatsapp/wamid-idempotency";
import {
  getWhatsAppWebhookValue,
  inboundMessageHasWork,
  isStatusOnlyWebhook,
  isSupportedInboundMessageType,
} from "@/lib/whatsapp/webhook-inbound";

describe("WhatsApp webhook payload filters", () => {
  it("treats delivery receipts without messages as status-only", () => {
    const value = getWhatsAppWebhookValue({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [{ id: "wamid.OUT", status: "delivered" }],
              },
            },
          ],
        },
      ],
    });

    expect(value).not.toBeNull();
    expect(isStatusOnlyWebhook(value!)).toBe(true);
  });

  it("does not treat a customer message as a status-only event", () => {
    expect(
      isStatusOnlyWebhook({
        messages: [
          {
            id: "wamid.IN",
            from: "919876543210",
            type: "text",
            text: { body: "hi" },
          },
        ],
        statuses: [{ id: "wamid.OUT", status: "sent" }],
      })
    ).toBe(false);
  });

  it("ignores unknown, empty, and system events", () => {
    expect(isSupportedInboundMessageType("text")).toBe(true);
    expect(isSupportedInboundMessageType("image")).toBe(true);
    expect(isSupportedInboundMessageType("sticker")).toBe(false);
    expect(isSupportedInboundMessageType("unsupported")).toBe(false);
    expect(isSupportedInboundMessageType("button")).toBe(false);
    expect(
      inboundMessageHasWork({
        id: "wamid.EMPTY",
        from: "919876543210",
        type: "text",
        text: { body: "   " },
      })
    ).toBe(false);
    expect(
      inboundMessageHasWork({
        id: "wamid.IMG",
        from: "919876543210",
        type: "image",
        image: {},
      })
    ).toBe(false);
  });
});

describe("claimWhatsAppWamid", () => {
  beforeEach(() => {
    redisState.set.mockReset();
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    process.env.APP_ENV = "production";
  });

  it("claims a new wamid with a 24h NX key", async () => {
    redisState.set.mockResolvedValue("OK");

    await expect(claimWhatsAppWamid("wamid.HBgM")).resolves.toBe(true);
    expect(redisState.set).toHaveBeenCalledWith(
      whatsAppWamidKey("wamid.HBgM"),
      "1",
      { nx: true, ex: 86400 }
    );
  });

  it("rejects a wamid that Redis already holds", async () => {
    redisState.set.mockResolvedValue(null);

    await expect(claimWhatsAppWamid("wamid.HBgM")).resolves.toBe(false);
  });
});
