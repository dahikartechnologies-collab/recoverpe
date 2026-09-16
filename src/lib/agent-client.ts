import { getAuthHeaders, getAuthHeadersForUpload } from "@/lib/auth-headers";
import { parseApiJsonResponse } from "@/lib/parse-api-response";
import { AgentKycDocuments } from "@/lib/agent/kyc-storage";

export interface AgentReferralRecord {
  id: string;
  merchant_phone: string;
  business_name: string | null;
  discount_bps: number;
  status: string;
  activated_at: string | null;
  created_at: string;
}

export interface AgentAnalytics {
  leads_generated: number;
  sales_closed: number;
  total_earnings_inr: number;
  pending_remittance_inr: number;
}

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

export async function fetchAgentMe(): Promise<AgentMeResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch("/api/agent/me", { headers });

  return parseApiJsonResponse<AgentMeResponse>(response);
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
