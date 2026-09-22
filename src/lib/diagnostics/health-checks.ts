import { getAdminAppInstance } from "@/lib/firebase-admin";
import { pingRateLimitRedis } from "@/lib/rate-limit";
import { pingRazorpayApi } from "@/lib/razorpay";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import {
  DiagnosticServiceResult,
  DiagnosticsHealthResponse,
} from "@/types";

async function checkSupabase(): Promise<DiagnosticServiceResult> {
  try {
    const supabase = createAdminSupabaseClient();
    const { count, error } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });

    if (error) {
      return { status: "failed", error: error.message };
    }

    if (typeof count !== "number") {
      return { status: "failed", error: "Supabase count probe returned no data." };
    }

    return { status: "ok" };
  } catch (error) {
    return {
      status: "failed",
      error:
        error instanceof Error ? error.message : "Supabase health check failed.",
    };
  }
}

async function checkFirebase(): Promise<DiagnosticServiceResult> {
  try {
    getAdminAppInstance();
    return { status: "ok" };
  } catch (error) {
    return {
      status: "failed",
      error:
        error instanceof Error
          ? error.message
          : "Firebase Admin health check failed.",
    };
  }
}

async function checkRedis(): Promise<DiagnosticServiceResult> {
  try {
    const ok = await pingRateLimitRedis();

    if (!ok) {
      return { status: "failed", error: "Upstash Redis ping returned false." };
    }

    return { status: "ok" };
  } catch (error) {
    return {
      status: "failed",
      error:
        error instanceof Error ? error.message : "Redis health check failed.",
    };
  }
}

async function checkRazorpay(): Promise<DiagnosticServiceResult> {
  try {
    const ok = await pingRazorpayApi();

    if (!ok) {
      return {
        status: "failed",
        error:
          "Razorpay API ping failed or credentials are missing/invalid.",
      };
    }

    return { status: "ok" };
  } catch (error) {
    return {
      status: "failed",
      error:
        error instanceof Error ? error.message : "Razorpay health check failed.",
    };
  }
}

async function checkVapi(): Promise<DiagnosticServiceResult> {
  try {
    const apiKey =
      process.env.VAPI_PRIVATE_KEY?.trim() || process.env.VAPI_API_KEY?.trim();
    const assistantId = process.env.VAPI_ASSISTANT_ID?.trim();
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();

    if (!apiKey) {
      return {
        status: "failed",
        error: "Missing VAPI_PRIVATE_KEY or VAPI_API_KEY.",
      };
    }

    if (!assistantId || !phoneNumberId) {
      return {
        status: "failed",
        error: "Missing VAPI_ASSISTANT_ID or VAPI_PHONE_NUMBER_ID.",
      };
    }

    const response = await fetch("https://api.vapi.ai/assistant", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        status: "failed",
        error: `VAPI API responded with ${response.status}: ${errorBody.slice(0, 200)}`,
      };
    }

    return { status: "ok" };
  } catch (error) {
    return {
      status: "failed",
      error:
        error instanceof Error ? error.message : "VAPI health check failed.",
    };
  }
}

function collectServiceErrors(
  entries: Array<[keyof DiagnosticsHealthResponse["services"], DiagnosticServiceResult]>
): DiagnosticsHealthResponse["service_errors"] {
  const serviceErrors: NonNullable<DiagnosticsHealthResponse["service_errors"]> =
    {};

  for (const [service, result] of entries) {
    if (result.status === "failed" && result.error) {
      serviceErrors[service] = result.error;
    }
  }

  return Object.keys(serviceErrors).length > 0 ? serviceErrors : undefined;
}

export async function runIntegrationHealthChecks(): Promise<DiagnosticsHealthResponse> {
  const settled = await Promise.allSettled([
    checkSupabase(),
    checkFirebase(),
    checkRedis(),
    checkRazorpay(),
    checkVapi(),
  ]);

  const unwrap = (
    result: PromiseSettledResult<DiagnosticServiceResult>,
    fallbackMessage: string
  ): DiagnosticServiceResult => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      status: "failed",
      error:
        result.reason instanceof Error
          ? result.reason.message
          : fallbackMessage,
    };
  };

  const entries: Array<
    [keyof DiagnosticsHealthResponse["services"], DiagnosticServiceResult]
  > = [
    ["supabase", unwrap(settled[0], "Supabase health check rejected.")],
    ["firebase", unwrap(settled[1], "Firebase health check rejected.")],
    ["redis", unwrap(settled[2], "Redis health check rejected.")],
    ["razorpay", unwrap(settled[3], "Razorpay health check rejected.")],
    ["vapi", unwrap(settled[4], "VAPI health check rejected.")],
  ];

  const services = Object.fromEntries(
    entries.map(([service, result]) => [service, result.status])
  ) as DiagnosticsHealthResponse["services"];

  const allOk = Object.values(services).every((status) => status === "ok");

  return {
    status: allOk ? "ok" : "degraded",
    services,
    service_errors: collectServiceErrors(entries),
    checked_at: new Date().toISOString(),
  };
}
