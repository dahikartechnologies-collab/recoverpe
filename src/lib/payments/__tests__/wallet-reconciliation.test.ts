import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createFakeSupabase,
  DEFAULT_STALE_AFTER_SECONDS,
  FakeDb,
} from "./fake-supabase";
import { reconcileContactVirtualAccountCredit } from "@/lib/payments/wallet-reconciliation";
import { ParsedRazorpaySmartCollectCredit } from "@/lib/reconciliation/razorpay-smart-collect";

const { dispatchOmnichannelMessage } = vi.hoisted(() => ({
  dispatchOmnichannelMessage: vi.fn(),
}));

vi.mock("@/lib/notifications/dispatcher", () => ({
  dispatchOmnichannelMessage,
}));

const USER_ID = "user-1";
const CONTACT_ID = "contact-1";
const RAZORPAY_VA_ID = "va_LiveAccount01";

function buildCredit(
  overrides: Partial<ParsedRazorpaySmartCollectCredit> = {}
): ParsedRazorpaySmartCollectCredit {
  return {
    event: "virtual_account.credited",
    externalEventId: "pay_abc123",
    externalPaymentId: "pay_abc123",
    amountPaise: 500000,
    amountRupees: 5000,
    currency: "INR",
    razorpayVirtualAccountId: RAZORPAY_VA_ID,
    paymentMethod: "upi",
    rawPayload: {},
    ...overrides,
  };
}

function seedCanonical(overrides: FakeDb = {}): FakeDb {
  return {
    contacts: [
      {
        id: CONTACT_ID,
        user_id: USER_ID,
        name: "Sharma Traders",
        phone_number: "919999999999",
        wallet_balance: 0,
        virtual_account_id: RAZORPAY_VA_ID,
      },
    ],
    ledgers: [
      {
        id: "ledger-1",
        user_id: USER_ID,
        contact_id: CONTACT_ID,
        balance_due: 3000,
        status: "overdue",
        business_id: "biz-1",
        created_at: "2026-01-01",
      },
    ],
    ...overrides,
  };
}

function walletBalance(db: FakeDb): number {
  return Number(db.contacts[0].wallet_balance);
}

beforeEach(() => {
  dispatchOmnichannelMessage.mockReset();
  dispatchOmnichannelMessage.mockResolvedValue({
    success: true,
    message: "sent",
    channel: "whatsapp",
  });
});

describe("reconcileContactVirtualAccountCredit", () => {
  it("credits the wallet once and settles the oldest open ledger", async () => {
    const { client, db } = createFakeSupabase(seedCanonical());

    const result = await reconcileContactVirtualAccountCredit(
      client,
      buildCredit()
    );

    expect(result?.already_processed).toBe(false);
    expect(result?.amount_credited).toBe(5000);
    expect(result?.total_applied_to_ledgers).toBe(3000);
    expect(result?.ledgers_paid).toEqual(["ledger-1"]);
    // 5000 in, 3000 applied to the only open ledger, 2000 stays as advance.
    expect(walletBalance(db)).toBe(2000);
    expect(db.inbound_payments[0].status).toBe("partially_allocated");
  });

  it("credits the wallet exactly once when the same event is delivered concurrently", async () => {
    const { client, db } = createFakeSupabase(seedCanonical());

    const results = await Promise.all([
      reconcileContactVirtualAccountCredit(client, buildCredit()),
      reconcileContactVirtualAccountCredit(client, buildCredit()),
    ]);

    const totalCredited = results.reduce(
      (sum, entry) => sum + Number(entry?.amount_credited ?? 0),
      0
    );

    // The regression this test exists for: before the compare-and-set the
    // wallet was credited twice, handing the debtor 5000 rupees of free credit.
    expect(totalCredited).toBe(5000);
    expect(walletBalance(db)).toBe(2000);
    expect(db.inbound_payments).toHaveLength(1);

    // One invocation owns the event; the other stands down without allocating.
    expect(results.filter((entry) => entry?.in_progress === true)).toHaveLength(1);

    // The ledger must be settled once, not twice.
    expect(
      db.transactions.filter((row) => row.ledger_id === "ledger-1")
    ).toHaveLength(1);
    expect(Number(db.ledgers[0].balance_due)).toBe(0);
  });

  it("returns already_processed on replay without re-crediting", async () => {
    const { client, db } = createFakeSupabase(seedCanonical());

    await reconcileContactVirtualAccountCredit(client, buildCredit());
    const balanceAfterFirst = walletBalance(db);

    const replay = await reconcileContactVirtualAccountCredit(
      client,
      buildCredit()
    );

    expect(replay?.already_processed).toBe(true);
    expect(replay?.amount_credited).toBe(0);
    expect(walletBalance(db)).toBe(balanceAfterFirst);
  });

  it("stands down when another invocation already holds the claim", async () => {
    const { client, db } = createFakeSupabase(
      seedCanonical({
        inbound_payments: [
          {
            id: "inbound-1",
            user_id: USER_ID,
            contact_id: CONTACT_ID,
            provider: "razorpay",
            external_event_id: "pay_abc123",
            status: "processing",
            // Claimed a moment ago: a live run, not a crashed one.
            processing_started_at: new Date().toISOString(),
            amount: 5000,
          },
        ],
      })
    );

    const result = await reconcileContactVirtualAccountCredit(
      client,
      buildCredit()
    );

    expect(result?.in_progress).toBe(true);
    expect(result?.amount_credited).toBe(0);
    expect(result?.total_applied_to_ledgers).toBe(0);
    expect(db.transactions).toHaveLength(0);
    expect(Number(db.ledgers[0].balance_due)).toBe(3000);
  });

  it("resumes allocation without re-crediting when a prior run crashed mid-flight", async () => {
    // Money already in the wallet, event stranded in 'processing' long enough
    // that the holder must be assumed dead.
    const staleClaimedAt = new Date(
      Date.now() - (DEFAULT_STALE_AFTER_SECONDS + 60) * 1000
    ).toISOString();

    const { client, db } = createFakeSupabase(
      seedCanonical({
        contacts: [
          {
            id: CONTACT_ID,
            user_id: USER_ID,
            name: "Sharma Traders",
            phone_number: "919999999999",
            wallet_balance: 5000,
            virtual_account_id: RAZORPAY_VA_ID,
          },
        ],
        inbound_payments: [
          {
            id: "inbound-1",
            user_id: USER_ID,
            contact_id: CONTACT_ID,
            provider: "razorpay",
            external_event_id: "pay_abc123",
            status: "processing",
            processing_started_at: staleClaimedAt,
            amount: 5000,
          },
        ],
      })
    );

    const result = await reconcileContactVirtualAccountCredit(
      client,
      buildCredit()
    );

    expect(result?.in_progress).toBeUndefined();
    expect(result?.amount_credited).toBe(0);
    expect(result?.total_applied_to_ledgers).toBe(3000);
    // 5000 was already there; only the 3000 allocation leaves.
    expect(walletBalance(db)).toBe(2000);
  });

  it("resolves a contact through the legacy virtual_accounts table", async () => {
    const { client, db } = createFakeSupabase({
      contacts: [
        {
          id: CONTACT_ID,
          user_id: USER_ID,
          name: "Legacy Vendor",
          phone_number: "919888888888",
          wallet_balance: 0,
          virtual_account_id: null,
        },
      ],
      virtual_accounts: [
        {
          id: "va-row-1",
          user_id: USER_ID,
          business_id: "biz-1",
          contact_id: CONTACT_ID,
          provider: "razorpay",
          provider_reference_id: RAZORPAY_VA_ID,
          status: "active",
        },
      ],
      ledgers: [
        {
          id: "ledger-legacy",
          user_id: USER_ID,
          contact_id: CONTACT_ID,
          balance_due: 5000,
          status: "overdue",
          business_id: "biz-1",
          created_at: "2026-01-01",
        },
      ],
    });

    const result = await reconcileContactVirtualAccountCredit(
      client,
      buildCredit()
    );

    expect(result?.virtual_account_source).toBe("legacy_virtual_account");
    expect(result?.total_applied_to_ledgers).toBe(5000);
    expect(walletBalance(db)).toBe(0);
    // Legacy linkage is preserved on the inbound payment row.
    expect(db.inbound_payments[0].virtual_account_id).toBe("va-row-1");
    expect(db.inbound_payments[0].business_id).toBe("biz-1");
  });

  it("returns null for a virtual account that belongs to nobody", async () => {
    const { client } = createFakeSupabase({ contacts: [], virtual_accounts: [] });

    const result = await reconcileContactVirtualAccountCredit(
      client,
      buildCredit()
    );

    expect(result).toBeNull();
  });

  it("ignores a suspended legacy virtual account", async () => {
    const { client } = createFakeSupabase({
      contacts: [
        {
          id: CONTACT_ID,
          user_id: USER_ID,
          name: "Suspended Vendor",
          phone_number: "919777777777",
          wallet_balance: 0,
          virtual_account_id: null,
        },
      ],
      virtual_accounts: [
        {
          id: "va-row-2",
          user_id: USER_ID,
          business_id: "biz-1",
          contact_id: CONTACT_ID,
          provider: "razorpay",
          provider_reference_id: RAZORPAY_VA_ID,
          status: "closed",
        },
      ],
    });

    const result = await reconcileContactVirtualAccountCredit(
      client,
      buildCredit()
    );

    expect(result).toBeNull();
  });
});
