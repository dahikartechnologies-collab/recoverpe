import { SupabaseClient } from "@supabase/supabase-js";
import {
  DpdpErasureResult,
  eraseDpdpUser,
  fetchDpdpPurgeCandidates,
} from "@/lib/dpdp-erasure";

export { fetchDpdpPurgeCandidates } from "@/lib/dpdp-erasure";

export interface DpdpPurgeResult {
  deleted_user_id: string;
  deleted_email: string;
  firebase_auth_deleted?: boolean;
  storage_objects_deleted?: number;
}

export interface DpdpPurgeRunSummary {
  purged: DpdpPurgeResult[];
  failures: Array<{
    user_id: string;
    email: string;
    message: string;
  }>;
}

export async function runDpdpAutoPurge(
  supabase: SupabaseClient
): Promise<DpdpPurgeResult[]> {
  const candidates = await fetchDpdpPurgeCandidates(supabase);
  const summary = await runDpdpAutoPurgeForCandidates(supabase, candidates);
  return summary.purged;
}

export async function runDpdpAutoPurgeForCandidates(
  supabase: SupabaseClient,
  candidates: Awaited<ReturnType<typeof fetchDpdpPurgeCandidates>>
): Promise<DpdpPurgeRunSummary> {
  const purged: DpdpPurgeResult[] = [];
  const failures: DpdpPurgeRunSummary["failures"] = [];

  for (const candidate of candidates) {
    try {
      const result: DpdpErasureResult = await eraseDpdpUser(supabase, candidate);

      purged.push({
        deleted_user_id: result.deleted_user_id,
        deleted_email: result.deleted_email,
        firebase_auth_deleted: result.firebase_auth_deleted,
        storage_objects_deleted: result.storage_objects_deleted,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "DPDP erasure failed.";

      console.error("[dpdp-purge] Failed to erase user:", {
        user_id: candidate.id,
        email: candidate.email,
        message,
      });

      failures.push({
        user_id: candidate.id,
        email: candidate.email,
        message,
      });
    }
  }

  if (failures.length > 0) {
    console.warn("[dpdp-purge] Completed with failures:", failures);
  }

  return { purged, failures };
}
