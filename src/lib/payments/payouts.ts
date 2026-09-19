import { randomUUID } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { getRazorpayCredentials } from "@/lib/razorpay";

export interface AgentWithdrawalResult {
  payoutIds: string[];
  totalInr: number;
  utrNumber: string;
  razorpayPayoutId: string;
  settledAt: string;
}

function buildBasicAuth(keyId: string, keySecret: string): string {
  return Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

async function createRazorpayPayout(input: {
  amountPaise: number;
  accountNumber: string;
  ifsc: string;
  accountHolderName: string;
  referenceId: string;
}): Promise<{ id: string; utr: string }> {
  const credentials = getRazorpayCredentials();

  if (!credentials) {
    if (!isDevelopmentAppEnv()) {
      throw new Error("Razorpay payouts are not configured.");
    }

    const simulatedId = `pout_dev_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    return {
      id: simulatedId,
      utr: `NEFT${simulatedId.slice(-14).toUpperCase()}`,
    };
  }

  const accountNumber = process.env.RAZORPAYX_ACCOUNT_NUMBER?.trim();

  if (!accountNumber) {
    if (isDevelopmentAppEnv()) {
      const simulatedId = `pout_dev_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      return {
        id: simulatedId,
        utr: `NEFT${simulatedId.slice(-14).toUpperCase()}`,
      };
    }

    throw new Error("RAZORPAYX_ACCOUNT_NUMBER is required for live agent payouts.");
  }

  const response = await fetch("https://api.razorpay.com/v1/payouts", {
    method: "POST",
    headers: {
      Authorization: `Basic ${buildBasicAuth(credentials.keyId, credentials.keySecret)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      account_number: accountNumber,
      amount: input.amountPaise,
      currency: "INR",
      mode: "NEFT",
      purpose: "payout",
      fund_account: {
        account_type: "bank_account",
        bank_account: {
          name: input.accountHolderName,
          ifsc: input.ifsc,
          account_number: input.accountNumber,
        },
        contact: {
          name: input.accountHolderName,
          type: "employee",
          reference_id: input.referenceId,
        },
      },
      queue_if_low_balance: true,
      reference_id: input.referenceId,
      narration: "RecoverPe agent commission",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay payout failed: ${errorBody}`);
  }

  const payload = (await response.json()) as {
    id?: string;
    utr?: string;
  };

  if (!payload.id) {
    throw new Error("Razorpay payout response did not include a payout id.");
  }

  return {
    id: payload.id,
    utr: payload.utr ?? `NEFT${payload.id.replace(/[^A-Z0-9]/gi, "").slice(0, 14).toUpperCase()}`,
  };
}

export async function withdrawApprovedAgentPayouts(
  supabase: SupabaseClient,
  agentId: string
): Promise<AgentWithdrawalResult> {
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select(
      "bank_account_name, bank_account_number, bank_ifsc, bank_verified_at, kyc_verified_at"
    )
    .eq("id", agentId)
    .single();

  if (agentError || !agent) {
    throw new Error("Agent profile not found.");
  }

  if (!agent.bank_verified_at || !agent.kyc_verified_at) {
    throw new Error("Complete PAN and bank verification before withdrawing commissions.");
  }

  if (
    !agent.bank_account_name?.trim() ||
    !agent.bank_account_number?.trim() ||
    !agent.bank_ifsc?.trim()
  ) {
    throw new Error("Save verified bank details before requesting a withdrawal.");
  }

  const { data: approvedPayouts, error: payoutError } = await supabase
    .from("agent_payouts")
    .select("id, amount_inr")
    .eq("agent_id", agentId)
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  if (payoutError) {
    throw new Error(payoutError.message || "Failed to load approved payouts.");
  }

  if (!approvedPayouts?.length) {
    throw new Error("No approved commissions are available to withdraw.");
  }

  const totalInr = approvedPayouts.reduce(
    (sum, row) => sum + Number(row.amount_inr ?? 0),
    0
  );

  if (totalInr <= 0) {
    throw new Error("Withdrawable balance must be greater than zero.");
  }

  const referenceId = `agent_${agentId.slice(0, 8)}_${Date.now()}`;
  const razorpayPayout = await createRazorpayPayout({
    amountPaise: Math.round(totalInr * 100),
    accountNumber: agent.bank_account_number as string,
    ifsc: agent.bank_ifsc as string,
    accountHolderName: agent.bank_account_name as string,
    referenceId,
  });

  const settledAt = new Date().toISOString();
  const payoutIds = approvedPayouts.map((row) => row.id as string);

  const { error: updateError } = await supabase
    .from("agent_payouts")
    .update({
      status: "paid",
      utr_number: razorpayPayout.utr,
      settled_at: settledAt,
      razorpay_payout_id: razorpayPayout.id,
    })
    .in("id", payoutIds);

  if (updateError) {
    throw new Error(updateError.message || "Failed to mark payouts as paid.");
  }

  return {
    payoutIds,
    totalInr,
    utrNumber: razorpayPayout.utr,
    razorpayPayoutId: razorpayPayout.id,
    settledAt,
  };
}
