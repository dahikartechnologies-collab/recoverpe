import { getAuthHeaders, getAuthHeadersForUpload } from "@/lib/auth-headers";
import { readApiJsonBody } from "@/lib/parse-api-response";
import {
  ParchiCommitPayload,
  ParchiCommitResponse,
  ParchiInboxResponse,
  ParchiUploadResponse,
  StockDashboardResponse,
  StockItemResponse,
  StockMovementsResponse,
  VoiceCommandExecuteResponse,
  VoiceCommandParseResponse,
  VoiceExecutePayload,
} from "@/lib/smart-stocks/shared";

export class SmartStocksApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "SmartStocksApiError";
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(
  url: string,
  init: RequestInit & { upload?: boolean } = {}
): Promise<T> {
  const { upload, ...rest } = init;
  const headers = upload ? await getAuthHeadersForUpload() : await getAuthHeaders();
  const response = await fetch(url, { ...rest, headers });
  const body = await readApiJsonBody<T & { error?: string; code?: string }>(response);

  if (!response.ok) {
    throw new SmartStocksApiError(
      body.error || `Request failed (${response.status}).`,
      response.status,
      body.code ?? null
    );
  }

  return body;
}

export function fetchStockDashboard(businessId: string) {
  return requestJson<StockDashboardResponse>(
    `/api/smart-stocks/items?business_id=${encodeURIComponent(businessId)}`
  );
}

export function fetchParchiInbox(businessId: string) {
  return requestJson<ParchiInboxResponse>(
    `/api/smart-stocks/parchi-reader?business_id=${encodeURIComponent(businessId)}`
  );
}

export function uploadParchi(businessId: string, file: File) {
  const form = new FormData();
  form.append("business_id", businessId);
  form.append("file", file);

  return requestJson<ParchiUploadResponse>("/api/smart-stocks/parchi-reader", {
    method: "POST",
    body: form,
    upload: true,
  });
}

export function commitParchi(payload: ParchiCommitPayload) {
  return requestJson<ParchiCommitResponse>("/api/smart-stocks/parchi-reader/commit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function rejectParchi(captureId: string) {
  return requestJson<{ success: true; capture_id: string }>(
    `/api/smart-stocks/parchi-reader/${captureId}/reject`,
    { method: "POST" }
  );
}

export interface CreateStockItemInput {
  business_id: string;
  name: string;
  unit: string;
  qty_on_hand?: number;
  reorder_level?: number;
  last_cost?: number;
  selling_price?: number;
  gst_rate?: number;
  hsn?: string | null;
}

export function createStockItem(input: CreateStockItemInput) {
  return requestJson<StockItemResponse>("/api/smart-stocks/items", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface AdjustStockItemInput {
  direction?: "in" | "out";
  qty?: number;
  rate?: number;
  reorder_level?: number;
  selling_price?: number;
}

export function adjustStockItem(itemId: string, input: AdjustStockItemInput) {
  return requestJson<StockItemResponse>(`/api/smart-stocks/items/${itemId}/adjust`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchStockMovements(itemId: string) {
  return requestJson<StockMovementsResponse>(
    `/api/smart-stocks/items/${itemId}/movements`
  );
}

export function parseVoiceCommand(businessId: string, transcript: string) {
  return requestJson<VoiceCommandParseResponse>("/api/smart-stocks/voice-command", {
    method: "POST",
    body: JSON.stringify({ business_id: businessId, transcript }),
  });
}

export function executeVoiceCommand(payload: VoiceExecutePayload) {
  return requestJson<VoiceCommandExecuteResponse>(
    "/api/smart-stocks/voice-command/execute",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}
