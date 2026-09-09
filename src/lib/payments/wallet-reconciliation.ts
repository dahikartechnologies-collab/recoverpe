import { SupabaseClient } from "@supabase/supabase-js";
import { refreshContactRiskScoreAsync } from "@/lib/contact-risk-score";
import { dispatchOmnichannelMessage } from "@/lib/notifications/dispatcher";
import {
  resolveVirtualAccountOwner,
  ResolvedVirtualAccountOwner,
} from "@/lib/payments/virtual-account-directory";
import {
  isPostgresUniqueViolation,
  ParsedRazorpaySmartCollectCredit,
} from "@/lib/reconciliation/razorpay-smart-collect";
import {
  InboundPaymentStatus,
  TERMINAL_INBOUND_PAYMENT_STATUSES,
} from "@/types";

interface OpenLedgerRow {
  id: string;
  balance_due: number;
  business_id: string | null;
}

interface InboundPaymentRow {
  id: string;
  user_id: string;
  contact_id: string | null;
  status: InboundPaymentStatus;
  amount: number;
}

export type ClaimOutcome =
  | "credited"
  | "resumed"
  | "in_progress"
  | "already_final";

interface ClaimResult {
  outcome: ClaimOutcome;
  status: InboundPaymentStatus;
  wallet_balance: number | null;
}

export interface WalletReconciliationResult {
  received: boolean;
  already_processed?: boolean;
  /** True when another invocation currently holds the processing claim. */
  in_progress?: boolean;
  contact_id: string;
  inbound_payment_id: string;
  /** Amount credited to the wallet by this invocation. 0 when another invocation already credited it. */
  amount_credited: number;
  total_applied_to_ledgers: number;
  ledgers_paid: string[];
  wallet_balance_remaining: number;
  net_outstanding: number;
  virtual_account_source?: ResolvedVirtualAccountOwner["source"];
  receipt_dispatch?: {
    success: boolean;
    message: string;
    channel?: string;
  };
}

function isTerminalStatus(status: InboundPaymentStatus): boolean {
  return TERMINAL_INBOUND_PAYMENT_STATUSES.includes(status);
}

function resolvePaymentMethod(
  paymentMethod: string | null
): "upi_link" | "bank_transfer" {
  if (paymentMethod?.toLowerCase() === "upi") {
    return "upi_link";
  }

  return "bank_transfer";
}

async function loadInboundPayment(
  supabase: SupabaseClient,
  externalEventId: string
): Promise<InboundPaymentRow | null> {
  const { data, error } = await supabase
    .from("inbound_payments")
    .select("id, user_id, contact_id, status, amount")
    .eq("provider", "razorpay")
    .eq("external_event_id", externalEventId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load inbound payment.");
  }

  return (data as InboundPaymentRow | null) ?? null;
}

async function insertInboundPayment(
  supabase: SupabaseClient,
  input: {
    userId: string;
    contactId: string;
    legacyVirtualAccountId: string | null;
    legacyBusinessId: string | null;
    externalEventId: string;
    externalPaymentId: string;
    amountRupees: number;
    currency: string;
    rawPayload: unknown;
  }
): Promise<InboundPaymentRow> {
  const { data, error } = await supabase
    .from("inbound_payments")
    .insert({
      user_id: input.userId,
      virtual_account_id: input.legacyVirtualAccountId,
      business_id: input.legacyBusinessId,
      contact_id: input.contactId,
      provider: "razorpay",
      external_event_id: input.externalEventId,
      external_payment_id: input.externalPaymentId,
      amount: input.amountRupees,
      currency: input.currency,
      raw_payload: input.rawPayload,
      status: "received",
    })
    .select("id, user_id, contact_id, status, amount")
    .single();

  if (error) {
    throw error;
  }

  return data as InboundPaymentRow;
}

/**
 * Atomically moves the event from 'received' to 'processing' and credits the
 * wallet in the same database transaction. Losing the race is normal and
 * expected: Razorpay retries, and duplicate deliveries are common.
 *
 * The returned outcome also decides who may allocate. Allocation reads open
 * ledgers before debiting the wallet, so only the claim holder may run it.
 */
async function claimAndCreditWallet(
  supabase: SupabaseClient,
  input: {
    inboundPaymentId: string;
    userId: string;
    contactId: string;
    amountRupees: number;
  }
): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc(
    "claim_and_credit_inbound_payment",
    {
      p_inbound_payment_id: input.inboundPaymentId,
      p_user_id: input.userId,
      p_contact_id: input.contactId,
      p_amount: input.amountRupees,
    }
  );

  if (error) {
    throw new Error(
      error.message || "Failed to claim inbound payment for processing."
    );
  }

  if (!data || typeof data !== "object") {
    throw new Error("Unexpected response from claim_and_credit_inbound_payment.");
  }

  return data as ClaimResult;
}

async function finalizeInboundPayment(
  supabase: SupabaseClient,
  inboundPaymentId: string,
  status: Extract<
    InboundPaymentStatus,
    "allocated" | "partially_allocated" | "duplicate" | "failed"
  >
): Promise<void> {
  const { error } = await supabase.rpc("finalize_inbound_payment", {
    p_inbound_payment_id: inboundPaymentId,
    p_status: status,
  });

  if (error) {
    throw new Error(error.message || "Failed to finalize inbound payment.");
  }
}

async function fetchOpenLedgersOldestFirst(
  supabase: SupabaseClient,
  userId: string,
  contactId: string
): Promise<OpenLedgerRow[]> {
  const { data, error } = await supabase
    .from("ledgers")
    .select("id, balance_due, business_id")
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .gt("balance_due", 0)
    .not("status", "in", '("paid","cancelled","refunded")')
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load open ledgers.");
  }

  return (data as OpenLedgerRow[]) ?? [];
}

async function computeNetOutstanding(
  supabase: SupabaseClient,
  userId: string,
  contactId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("ledgers")
    .select("balance_due")
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .gt("balance_due", 0)
    .not("status", "in", '("paid","cancelled","refunded")');

  if (error) {
    throw new Error(error.message || "Failed to compute net outstanding.");
  }

  return (data ?? []).reduce(
    (sum, row) => sum + Number(row.balance_due ?? 0),
    0
  );
}

async function readWalletBalance(
  supabase: SupabaseClient,
  userId: string,
  contactId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("contacts")
    .select("wallet_balance")
    .eq("id", contactId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to read wallet balance.");
  }

  return Number(data?.wallet_balance ?? 0);
}

async function applyWalletToOpenLedgers(input: {
  supabase: SupabaseClient;
  userId: string;
  contactId: string;
  inboundPaymentId: string;
  externalPaymentId: string;
  paymentMethod: string | null;
}): Promise<{
  totalApplied: number;
  ledgersPaid: string[];
  walletBalanceRemaining: number;
}> {
  const ledgers = await fetchOpenLedgersOldestFirst(
    input.supabase,
    input.userId,
    input.contactId
  );

  let totalApplied = 0;
  const ledgersPaid: string[] = [];
  const txnPaymentMethod = resolvePaymentMethod(input.paymentMethod);

  for (const ledger of ledgers) {
    const { data: existingTransaction } = await input.supabase
      .from("transactions")
      .select("id")
      .eq("ledger_id", ledger.id)
      .eq("reference_id", input.externalPaymentId)
      .maybeSingle();

    if (existingTransaction) {
      continue;
    }

    const { data: walletApplied, error: debitError } = await input.supabase.rpc(
      "debit_contact_wallet",
      {
        p_user_id: input.userId,
        p_contact_id: input.contactId,
        p_amount: Number(ledger.balance_due),
      }
    );

    if (debitError) {
      throw new Error(
        debitError.message || "Failed to debit contact wallet for reconciliation."
      );
    }

    const appliedAmount = Number(walletApplied ?? 0);

    if (appliedAmount <= 0) {
      break;
    }

    const { error: transactionError } = await input.supabase
      .from("transactions")
      .insert({
        ledger_id: ledger.id,
        transaction_type: "payment_received",
        amount: appliedAmount,
        payment_method: txnPaymentMethod,
        reference_id: input.externalPaymentId,
        collection_mode: "virtual_account",
        inbound_payment_id: input.inboundPaymentId,
        logged_by_user_id: null,
      });

    if (transactionError) {
      await input.supabase.rpc("credit_contact_wallet", {
        p_user_id: input.userId,
        p_contact_id: input.contactId,
        p_amount: appliedAmount,
      });

      throw new Error(
        transactionError.message ||
          "Failed to record reconciled payment transaction."
      );
    }

    totalApplied += appliedAmount;
    ledgersPaid.push(ledger.id);
  }

  return {
    totalApplied,
    ledgersPaid,
    walletBalanceRemaining: await readWalletBalance(
      input.supabase,
      input.userId,
      input.contactId
    ),
  };
}

async function dispatchReceipt(input: {
  supabase: SupabaseClient;
  userId: string;
  contactId: string;
  ledgerId: string;
  amountReceived: number;
  netOutstanding: number;
}): Promise<WalletReconciliationResult["receipt_dispatch"]> {
  const { data: ledger } = await input.supabase
    .from("ledgers")
    .select("business_id")
    .eq("id", input.ledgerId)
    .maybeSingle();

  try {
    const dispatchResult = await dispatchOmnichannelMessage({
      supabase: input.supabase,
      userId: input.userId,
      businessId: (ledger?.business_id as string | null) ?? null,
      contactId: input.contactId,
      ledgerId: input.ledgerId,
      options: {
        isPaymentReceipt: true,
      },
      messagePayload: {
        paymentReceipt: {
          amountReceived: input.amountReceived,
          netOutstanding: input.netOutstanding,
        },
      },
    });

    return {
      success: dispatchResult.success,
      message: dispatchResult.message,
      channel: dispatchResult.channel,
    };
  } catch (dispatchError) {
    return {
      success: false,
      message:
        dispatchError instanceof Error
          ? dispatchError.message
          : "Payment receipt dispatch failed.",
    };
  }
}

/**
 * Wallet-first reconciliation for a Razorpay virtual_account.credited event.
 *
 * Returns null when the virtual account is not registered to any contact, so
 * the caller can distinguish "not ours" from "handled".
 */
export async function reconcileContactVirtualAccountCredit(
  supabase: SupabaseClient,
  credit: ParsedRazorpaySmartCollectCredit
): Promise<WalletReconciliationResult | null> {
  const owner = await resolveVirtualAccountOwner(
    supabase,
    credit.razorpayVirtualAccountId
  );

  if (!owner) {
    return null;
  }

  let inboundPayment: InboundPaymentRow | null = null;

  try {
    inboundPayment = await insertInboundPayment(supabase, {
      userId: owner.userId,
      contactId: owner.contactId,
      legacyVirtualAccountId: owner.legacyVirtualAccountId,
      legacyBusinessId: owner.legacyBusinessId,
      externalEventId: credit.externalEventId,
      externalPaymentId: credit.externalPaymentId,
      amountRupees: credit.amountRupees,
      currency: credit.currency,
      rawPayload: credit.rawPayload,
    });
  } catch (insertError) {
    if (
      !isPostgresUniqueViolation(
        insertError as { code?: string; message?: string }
      )
    ) {
      throw insertError;
    }

    inboundPayment = await loadInboundPayment(supabase, credit.externalEventId);
  }

  if (!inboundPayment?.contact_id) {
    throw new Error("Inbound payment is missing contact context.");
  }

  const alreadyHandled = async (): Promise<WalletReconciliationResult> => ({
    received: true,
    already_processed: true,
    contact_id: owner.contactId,
    inbound_payment_id: inboundPayment!.id,
    amount_credited: 0,
    total_applied_to_ledgers: 0,
    ledgers_paid: [],
    wallet_balance_remaining: await readWalletBalance(
      supabase,
      owner.userId,
      owner.contactId
    ),
    net_outstanding: await computeNetOutstanding(
      supabase,
      owner.userId,
      owner.contactId
    ),
    virtual_account_source: owner.source,
  });

  if (isTerminalStatus(inboundPayment.status)) {
    return alreadyHandled();
  }

  // Compare-and-set. Only the invocation that wins the received -> processing
  // transition credits the wallet and goes on to allocate; every other
  // concurrent delivery of the same event stands down.
  const claim = await claimAndCreditWallet(supabase, {
    inboundPaymentId: inboundPayment.id,
    userId: owner.userId,
    contactId: owner.contactId,
    amountRupees: credit.amountRupees,
  });

  if (claim.outcome === "already_final") {
    return alreadyHandled();
  }

  if (claim.outcome === "in_progress") {
    // Another invocation owns this event right now. Allocation is not
    // re-entrant: running it here would debit the wallet a second time.
    return {
      ...(await alreadyHandled()),
      in_progress: true,
    };
  }

  // 'resumed' means a previous run crashed while holding the claim. The wallet
  // was credited then, so only allocation is outstanding.
  const amountCredited = claim.outcome === "credited" ? credit.amountRupees : 0;

  let totalApplied = 0;
  let ledgersPaid: string[] = [];
  let walletBalanceRemaining = 0;

  try {
    const allocation = await applyWalletToOpenLedgers({
      supabase,
      userId: owner.userId,
      contactId: owner.contactId,
      inboundPaymentId: inboundPayment.id,
      externalPaymentId: credit.externalPaymentId,
      paymentMethod: credit.paymentMethod,
    });

    totalApplied = allocation.totalApplied;
    ledgersPaid = allocation.ledgersPaid;
    walletBalanceRemaining = allocation.walletBalanceRemaining;
  } catch (reconcileError) {
    console.error(
      "[smart-collect] Wallet auto-reconciliation failed; funds remain in wallet_balance:",
      reconcileError instanceof Error ? reconcileError.message : reconcileError
    );

    // The credit stands. Close the event so a retry cannot credit it again;
    // the balance is recoverable from the wallet.
    await finalizeInboundPayment(
      supabase,
      inboundPayment.id,
      "partially_allocated"
    );

    throw reconcileError;
  }

  const allocationStatus =
    walletBalanceRemaining > 0 || totalApplied < credit.amountRupees
      ? "partially_allocated"
      : "allocated";

  await finalizeInboundPayment(supabase, inboundPayment.id, allocationStatus);

  const netOutstanding = await computeNetOutstanding(
    supabase,
    owner.userId,
    owner.contactId
  );

  const primaryLedgerId = ledgersPaid[0] ?? null;
  const receiptDispatch = primaryLedgerId
    ? await dispatchReceipt({
        supabase,
        userId: owner.userId,
        contactId: owner.contactId,
        ledgerId: primaryLedgerId,
        amountReceived: credit.amountRupees,
        netOutstanding,
      })
    : undefined;

  refreshContactRiskScoreAsync(supabase, owner.contactId);

  return {
    received: true,
    already_processed: false,
    contact_id: owner.contactId,
    inbound_payment_id: inboundPayment.id,
    amount_credited: amountCredited,
    total_applied_to_ledgers: totalApplied,
    ledgers_paid: ledgersPaid,
    wallet_balance_remaining: walletBalanceRemaining,
    net_outstanding: netOutstanding,
    virtual_account_source: owner.source,
    receipt_dispatch: receiptDispatch,
  };
}
