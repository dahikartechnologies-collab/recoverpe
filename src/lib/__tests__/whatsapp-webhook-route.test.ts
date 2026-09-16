import { beforeEach, describe, expect, it, vi } from "vitest";

const inbound = vi.hoisted(() => ({
  claim: vi.fn(),
  execute: vi.fn(),
  applyStatuses: vi.fn(),
  pending: [] as Promise<unknown>[],
}));

vi.mock("@/lib/whatsapp/verify-signature", () => ({
  verifyMetaWebhookSignature: () => ({ ok: true }),
  readMetaSignatureHeader: () => "sha256=test",
}));

vi.mock("@/lib/whatsapp/wamid-idempotency", () => ({
  claimWhatsAppWamid: inbound.claim,
}));

vi.mock("@/lib/whatsapp/webhook-inbound", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/whatsapp/webhook-inbound")
  >("@/lib/whatsapp/webhook-inbound");

  return {
    ...actual,
    executeInboundWhatsAppMessage: inbound.execute,
    applyInboundDeliveryStatuses: inbound.applyStatuses,
    deferWhatsAppWebhookWork: (work: Promise<unknown>) => {
      inbound.pending.push(work);
    },
  };
});

import { POST } from "@/app/api/webhooks/whatsapp/route";

function webhookRequest(body: unknown): Request {
  return new Request("https://recoverpe.test/api/webhooks/whatsapp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("WhatsApp webhook POST", () => {
  beforeEach(() => {
    inbound.claim.mockReset();
    inbound.execute.mockReset();
    inbound.applyStatuses.mockReset();
    inbound.pending = [];
    inbound.execute.mockResolvedValue(undefined);
    inbound.applyStatuses.mockResolvedValue(undefined);
  });

  it("acks status-only delivery receipts without Gemini", async () => {
    const response = await POST(
      webhookRequest({
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
      })
    );

    expect(response.status).toBe(200);
    await Promise.all(inbound.pending);
    expect(inbound.claim).not.toHaveBeenCalled();
    expect(inbound.execute).not.toHaveBeenCalled();
    expect(inbound.applyStatuses).toHaveBeenCalledTimes(1);
  });

  it("returns already_processed and skips dispatch on a duplicate wamid", async () => {
    inbound.claim.mockResolvedValue(false);

    const response = await POST(
      webhookRequest({
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: "wamid.HBgM",
                      from: "919876543210",
                      type: "text",
                      text: { body: "hello" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "already_processed",
    });
    expect(inbound.claim).toHaveBeenCalledWith("wamid.HBgM");
    expect(inbound.execute).not.toHaveBeenCalled();
  });

  it("ignores non-text non-image events", async () => {
    const response = await POST(
      webhookRequest({
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      id: "wamid.STICKER",
                      from: "919876543210",
                      type: "sticker",
                    },
                  ],
                },
              },
            ],
          },
        ],
      })
    );

    expect(response.status).toBe(200);
    expect(inbound.claim).not.toHaveBeenCalled();
    expect(inbound.execute).not.toHaveBeenCalled();
  });
});
