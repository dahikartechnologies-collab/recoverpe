import { getAuthHeaders, getAuthHeadersForUpload } from "@/lib/auth-headers";
import { readApiJsonBody } from "@/lib/parse-api-response";
import { AgentKycDocuments } from "@/lib/agent/kyc-storage";
import type {
  AgentAnalytics,
  AgentDiscountStats,
  AgentFinancials,
  AgentPayoutRecord,
} from "@/lib/agent/analytics";

export interface AgentReferralRecord {
  id: string;
  merchant_phone: string;
  business_name: string | null;
  discount_bps: number;
  status: string;
  activated_at: string | null;
  created_at: string;
}

export type { AgentAnalytics, AgentDiscountStats, AgentFinancials, AgentPayoutRecord };

export interface AgentMeResponse {
  agent: {
    id: string;
    display_name: string;
    status: string;
    referral_code: string;
    discount_cap_bps: number;
    wallet_liability_inr: number;
    open_cash_tickets: number;
    referrals_frozen: boolean;
    bank_account_name: string | null;
    bank_account_number: string | null;
    bank_ifsc: string | null;
    kyc_documents: AgentKycDocuments;
  };
  analytics: AgentAnalytics;
  referrals: AgentReferralRecord[];
}

export interface CreateReferralConflictOwned {
  error: "DUPLICATE_OWNED";
  referralId: string;
}

export interface CreateReferralConflictGlobal {
  error: "DUPLICATE_GLOBAL";
  message: string;
}

export type CreateReferralResult =
  | { ok: true; referral_id: string; status: string; otp_sent: boolean }
  | CreateReferralConflictOwned
  | CreateReferralConflictGlobal
  | { ok: false; message: string };

async function parseApiJsonResponse<T>(response: Response): Promise<T> {
  const body = await readApiJsonBody<T & { error?: string }>(response);

  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status}).`);
  }

  return body as T;
}

export async function fetchAgentMe(): Promise<AgentMeResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/agent/me", { headers });

  return parseApiJsonResponse<AgentMeResponse>(response);
}

export async function createAgentReferral(body: {
  merchant_phone: string;
  business_name?: string;
  discount_bps: number;
}): Promise<CreateReferralResult> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/agent/referrals", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const payload = await readApiJsonBody<
    | { referral_id: string; status: string; otp_sent: boolean }
    | CreateReferralConflictOwned
    | CreateReferralConflictGlobal
    | { error?: string }
  >(response);

  if (response.status === 409) {
    if ("error" in payload && payload.error === "DUPLICATE_OWNED" && "referralId" in payload) {
      return payload;
    }

    if ("error" in payload && payload.error === "DUPLICATE_GLOBAL" && "message" in payload) {
      return {
        error: "DUPLICATE_GLOBAL",
        message: payload.message,
      };
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      message:
        ("error" in payload && payload.error) ||
        `Request failed (${response.status}).`,
    };
  }

  const success = payload as {
    referral_id: string;
    status: string;
    otp_sent: boolean;
  };

  return {
    ok: true,
    referral_id: success.referral_id,
    status: success.status,
    otp_sent: Boolean(success.otp_sent),
  };
}

export async function patchAgentReferral(
  referralId: string,
  body: { discount_bps?: number; business_name?: string | null }
): Promise<AgentReferralRecord> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/agent/referrals/${referralId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });

  const payload = await parseApiJsonResponse<{ referral: AgentReferralRecord }>(response);

  return payload.referral;
}

export async function resendAgentReferralOtp(referralId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/agent/referrals/${referralId}/resend-otp`, {
    method: "POST",
    headers,
  });

  await parseApiJsonResponse(response);
}

export async function cancelAgentReferral(
  referralId: string,
  reason: string
): Promise<AgentReferralRecord> {
  const headers = await getAuthHeaders();
  const response = await fetch(`/api/agent/referrals/${referralId}/cancel`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reason }),
  });

  const payload = await parseApiJsonResponse<{ referral: AgentReferralRecord }>(
    response
  );

  return payload.referral;
}

export async function patchAgentBankProfile(body: {
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc: string;
}): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/agent/profile", {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });

  await parseApiJsonResponse(response);
}

export async function uploadAgentKycDocument(input: {
  side: "front" | "back";
  file: File;
}): Promise<void> {
  const headers = await getAuthHeadersForUpload();
  const formData = new FormData();
  formData.set("side", input.side);
  formData.set("file", input.file);

  const response = await fetch("/api/agent/profile/kyc", {
    method: "POST",
    headers,
    body: formData,
  });

  await parseApiJsonResponse(response);
}
