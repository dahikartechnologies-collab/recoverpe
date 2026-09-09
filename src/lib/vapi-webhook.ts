import { timingSafeEqual } from "crypto";
import {
  analyzeVapiTranscript,
  calculateVapiCreditCost,
  sentimentEmoji,
} from "@/lib/vapi-insights";

export interface ParsedVapiEndOfCallReport {
  vapi_call_id: string;
  ledger_id: string | null;
  user_id: string | null;
  duration_seconds: number;
  recording_url: string | null;
  transcript: string;
  summary: string | null;
}

export function verifyVapiWebhookSecret(request: Request): boolean {
  const configuredSecret = process.env.VAPI_WEBHOOK_SECRET?.trim();

  if (!configuredSecret) {
    return false;
  }

  const headerSecret =
    request.headers.get("x-vapi-secret")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    null;

  if (!headerSecret) {
    return false;
  }

  const expected = Buffer.from(configuredSecret, "utf8");
  const received = Buffer.from(headerSecret, "utf8");

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractTranscript(payload: Record<string, unknown>): string {
  const artifact =
    payload.artifact && typeof payload.artifact === "object"
      ? (payload.artifact as Record<string, unknown>)
      : null;

  const direct =
    readString(payload.transcript) ||
    readString(payload.transcription) ||
    (artifact ? readString(artifact.transcript) : null);

  if (direct) {
    return direct;
  }

  const messages = payload.messages;

  if (Array.isArray(messages)) {
    return messages
      .map((message) => {
        if (!message || typeof message !== "object") {
          return "";
        }

        const row = message as Record<string, unknown>;
        const role = readString(row.role) ?? "speaker";
        const content =
          readString(row.message) ||
          readString(row.content) ||
          readString(row.text) ||
          "";

        return content ? `${role}: ${content}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

export function parseVapiEndOfCallReport(
  payload: unknown
): ParsedVapiEndOfCallReport | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const root = payload as Record<string, unknown>;
  const message =
    root.message && typeof root.message === "object"
      ? (root.message as Record<string, unknown>)
      : root;

  const messageType = readString(message.type)?.toLowerCase() ?? "";

  if (messageType && !messageType.includes("end-of-call")) {
    return null;
  }

  const call =
    message.call && typeof message.call === "object"
      ? (message.call as Record<string, unknown>)
      : root.call && typeof root.call === "object"
        ? (root.call as Record<string, unknown>)
        : null;

  if (!call) {
    return null;
  }

  const vapi_call_id = readString(call.id);

  if (!vapi_call_id) {
    return null;
  }

  const metadata =
    call.metadata && typeof call.metadata === "object"
      ? (call.metadata as Record<string, unknown>)
      : {};

  const artifact =
    message.artifact && typeof message.artifact === "object"
      ? (message.artifact as Record<string, unknown>)
      : {};

  const duration_seconds =
    readNumber(message.durationSeconds) ||
    readNumber(message.duration) ||
    readNumber(call.durationSeconds) ||
    readNumber(call.duration) ||
    0;

  const recording_url =
    readString(message.recordingUrl) ||
    readString(call.recordingUrl) ||
    readString(artifact.recordingUrl) ||
    readString(artifact.stereoRecordingUrl);

  const transcript = extractTranscript({
    ...message,
    ...artifact,
    messages: message.messages ?? artifact.messages,
  });

  const analysis =
    message.analysis && typeof message.analysis === "object"
      ? (message.analysis as Record<string, unknown>)
      : null;

  const summary =
    readString(message.summary) ||
    readString(artifact.summary) ||
    (analysis ? readString(analysis.summary) : null);

  return {
    vapi_call_id,
    ledger_id: readString(metadata.ledger_id),
    user_id: readString(metadata.recoverpe_user_id),
    duration_seconds: Math.max(0, Math.round(duration_seconds)),
    recording_url,
    transcript,
    summary,
  };
}

export function buildVapiInsightsFromReport(report: ParsedVapiEndOfCallReport) {
  const insights = analyzeVapiTranscript(report.transcript, report.summary);
  const creditCost = calculateVapiCreditCost(report.duration_seconds);

  return {
    ...insights,
    sentiment_display: `${sentimentEmoji(insights.sentiment)} ${insights.sentiment_label}`,
    credit_cost: creditCost,
  };
}
