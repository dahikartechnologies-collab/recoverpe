import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Minimal in-memory stand-in for the Supabase service client, supporting only
 * the query shapes the reconciliation path uses.
 *
 * Two behaviours matter for correctness and are modelled faithfully:
 *
 *  1. Every operation yields the event loop before touching the store, so two
 *     concurrently awaited reconciliation runs genuinely interleave. Without
 *     this the test would pass trivially on JavaScript's single thread.
 *
 *  2. RPC bodies run to completion without yielding, mirroring a Postgres
 *     function executing inside one transaction. That is what makes the
 *     compare-and-set in claim_and_credit_inbound_payment atomic.
 */

export type Row = Record<string, unknown>;

export type FakeDb = Record<string, Row[]>;

export interface FakeSupabase {
  client: SupabaseClient;
  db: FakeDb;
  rpcCalls: { name: string; args: Record<string, unknown> }[];
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Mirrors the p_stale_after_seconds default in migration 035. */
export const DEFAULT_STALE_AFTER_SECONDS = 300;

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}_${++idCounter}`;

function parseInList(raw: string): string[] {
  return raw
    .replace(/^\(|\)$/g, "")
    .split(",")
    .map((value) => value.trim().replace(/^"|"$/g, ""));
}

class Query implements PromiseLike<{ data: unknown; error: unknown }> {
  private filters: ((row: Row) => boolean)[] = [];
  private mode: "select" | "insert" | "update" = "select";
  private payload: Row | null = null;
  private orderKey: string | null = null;
  private orderAscending = true;

  constructor(
    private readonly db: FakeDb,
    private readonly table: string
  ) {
    this.db[table] ??= [];
  }

  select(): this {
    return this;
  }

  insert(payload: Row): this {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row): this {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  gt(column: string, value: number): this {
    this.filters.push((row) => Number(row[column]) > Number(value));
    return this;
  }

  is(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  not(column: string, operator: string, value: string): this {
    if (operator === "in") {
      const excluded = parseInList(value);
      this.filters.push((row) => !excluded.includes(String(row[column])));
    }

    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderKey = column;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  private matches(): Row[] {
    const rows = this.db[this.table].filter((row) =>
      this.filters.every((predicate) => predicate(row))
    );

    if (!this.orderKey) {
      return rows;
    }

    const key = this.orderKey;

    return [...rows].sort((a, b) => {
      const left = String(a[key] ?? "");
      const right = String(b[key] ?? "");
      return this.orderAscending
        ? left.localeCompare(right)
        : right.localeCompare(left);
    });
  }

  private applyPaymentTrigger(transaction: Row): void {
    if (transaction.transaction_type !== "payment_received") {
      return;
    }

    const ledger = this.db.ledgers.find((row) => row.id === transaction.ledger_id);

    if (!ledger) {
      return;
    }

    const remaining =
      Number(ledger.balance_due ?? 0) - Number(transaction.amount ?? 0);

    ledger.balance_due = Math.max(remaining, 0);

    if (Number(ledger.balance_due) <= 0) {
      ledger.status = "paid";
    }
  }

  private async execute(): Promise<{ data: unknown; error: unknown }> {
    await tick();

    if (this.mode === "insert") {
      const row: Row = { id: nextId(String(this.table)), ...this.payload };

      if (this.table === "inbound_payments") {
        const duplicate = this.db.inbound_payments.some(
          (existing) =>
            existing.provider === row.provider &&
            existing.external_event_id === row.external_event_id
        );

        if (duplicate) {
          return {
            data: null,
            error: {
              code: "23505",
              message:
                'duplicate key value violates unique constraint "inbound_payments_provider_event_unique"',
            },
          };
        }
      }

      this.db[this.table].push(row);

      if (this.table === "transactions") {
        this.applyPaymentTrigger(row);
      }

      return { data: row, error: null };
    }

    if (this.mode === "update") {
      const matched = this.matches();
      matched.forEach((row) => Object.assign(row, this.payload));
      return { data: matched, error: null };
    }

    return { data: this.matches(), error: null };
  }

  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    const result = await this.execute();

    if (result.error) {
      return result;
    }

    const rows = Array.isArray(result.data) ? result.data : [result.data];
    return { data: rows[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: unknown }> {
    const result = await this.execute();

    if (result.error) {
      return result;
    }

    const rows = Array.isArray(result.data) ? result.data : [result.data];

    if (!rows[0]) {
      return { data: null, error: { message: "No rows returned." } };
    }

    return { data: rows[0], error: null };
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

function creditWallet(db: FakeDb, userId: string, contactId: string, amount: number) {
  if (!(amount > 0)) {
    throw new Error("credit_contact_wallet requires a positive amount.");
  }

  const contact = db.contacts.find(
    (row) => row.id === contactId && row.user_id === userId
  );

  if (!contact) {
    throw new Error("Contact not found or access denied.");
  }

  contact.wallet_balance = Number(contact.wallet_balance ?? 0) + amount;
  return Number(contact.wallet_balance);
}

function debitWallet(db: FakeDb, userId: string, contactId: string, amount: number) {
  const contact = db.contacts.find(
    (row) => row.id === contactId && row.user_id === userId
  );

  if (!contact) {
    throw new Error("Contact not found or access denied.");
  }

  const available = Math.max(Number(contact.wallet_balance ?? 0), 0);
  const applied = Math.min(available, amount);

  if (applied <= 0) {
    return 0;
  }

  contact.wallet_balance = Number(contact.wallet_balance) - applied;
  return applied;
}

export function createFakeSupabase(seed: FakeDb = {}): FakeSupabase {
  const db: FakeDb = {
    contacts: [],
    ledgers: [],
    transactions: [],
    inbound_payments: [],
    virtual_accounts: [],
    ...seed,
  };

  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];

  const client = {
    from(table: string) {
      return new Query(db, table);
    },

    async rpc(name: string, args: Record<string, unknown>) {
      // Yield before entering the function, never inside it: a Postgres
      // function body is a single atomic unit.
      await tick();
      rpcCalls.push({ name, args });

      try {
        if (name === "claim_and_credit_inbound_payment") {
          const payment = db.inbound_payments.find(
            (row) => row.id === args.p_inbound_payment_id
          );

          if (!payment) {
            throw new Error(`Inbound payment ${args.p_inbound_payment_id} not found.`);
          }

          if (payment.status === "received") {
            payment.status = "processing";
            payment.processing_started_at = new Date().toISOString();

            const balance = creditWallet(
              db,
              args.p_user_id as string,
              args.p_contact_id as string,
              Number(args.p_amount)
            );

            return {
              data: {
                outcome: "credited",
                status: "processing",
                wallet_balance: balance,
              },
              error: null,
            };
          }

          if (payment.status !== "processing") {
            return {
              data: {
                outcome: "already_final",
                status: payment.status,
                wallet_balance: null,
              },
              error: null,
            };
          }

          const staleAfterMs =
            Number(args.p_stale_after_seconds ?? DEFAULT_STALE_AFTER_SECONDS) * 1000;
          const claimedAt = payment.processing_started_at
            ? Date.parse(String(payment.processing_started_at))
            : null;
          const isStale =
            claimedAt !== null && Date.now() - claimedAt > staleAfterMs;

          if (!isStale) {
            return {
              data: {
                outcome: "in_progress",
                status: "processing",
                wallet_balance: null,
              },
              error: null,
            };
          }

          payment.processing_started_at = new Date().toISOString();

          return {
            data: {
              outcome: "resumed",
              status: "processing",
              wallet_balance: null,
            },
            error: null,
          };
        }

        if (name === "finalize_inbound_payment") {
          const terminal = [
            "allocated",
            "partially_allocated",
            "duplicate",
            "failed",
          ];

          if (!terminal.includes(String(args.p_status))) {
            throw new Error(
              `finalize_inbound_payment received a non-terminal status: ${args.p_status}`
            );
          }

          const payment = db.inbound_payments.find(
            (row) => row.id === args.p_inbound_payment_id
          );

          if (!payment) {
            throw new Error("Inbound payment not found.");
          }

          payment.status = args.p_status;
          payment.processed_at = new Date().toISOString();

          return { data: null, error: null };
        }

        if (name === "credit_contact_wallet") {
          return {
            data: creditWallet(
              db,
              args.p_user_id as string,
              args.p_contact_id as string,
              Number(args.p_amount)
            ),
            error: null,
          };
        }

        if (name === "debit_contact_wallet") {
          return {
            data: debitWallet(
              db,
              args.p_user_id as string,
              args.p_contact_id as string,
              Number(args.p_amount)
            ),
            error: null,
          };
        }

        throw new Error(`Unstubbed RPC: ${name}`);
      } catch (error) {
        return {
          data: null,
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  } as unknown as SupabaseClient;

  return { client, db, rpcCalls };
}
