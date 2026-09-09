import { getAdminAppInstance } from "@/lib/firebase-admin";
import { pingRateLimitRedis } from "@/lib/rate-limit";
import { pingRazorpayApi } from "@/lib/razorpay";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import {
  DiagnosticServiceStatus,
  DiagnosticsHealthResponse,
} from "@/types";

async function checkSupabase(): Promise<DiagnosticServiceStatus> {
  try {
    const supabase = createAdminSupabaseClient();
    const { count, error } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });

    if (error) {
      return "failed";
    }

    return typeof count === "number" ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

async function checkFirebase(): Promise<DiagnosticServiceStatus> {
  try {
    getAdminAppInstance();
    return "ok";
  } catch {
    return "failed";
  }
}

async function checkRedis(): Promise<DiagnosticServiceStatus> {
  try {
    return (await pingRateLimitRedis()) ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

async function checkRazorpay(): Promise<DiagnosticServiceStatus> {
  try {
    return (await pingRazorpayApi()) ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

export async function runIntegrationHealthChecks(): Promise<DiagnosticsHealthResponse> {
  const [supabase, firebase, redis, razorpay] = await Promise.all([
    checkSupabase(),
    checkFirebase(),
    checkRedis(),
    checkRazorpay(),
  ]);

  const services = { supabase, firebase, redis, razorpay };
  const allOk = Object.values(services).every((status) => status === "ok");

  return {
    status: allOk ? "ok" : "degraded",
    services,
    checked_at: new Date().toISOString(),
  };
}
