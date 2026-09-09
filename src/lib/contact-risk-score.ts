import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fire-and-forget risk score refresh. Never blocks the caller's critical path.
 */
export function refreshContactRiskScoreAsync(
  supabase: SupabaseClient,
  contactId: string
): void {
  if (!contactId.trim()) {
    return;
  }

  void (async () => {
    try {
      const { error } = await supabase.rpc("calculate_contact_risk_score", {
        p_contact_id: contactId,
      });

      if (error) {
        console.warn(
          `[contact-risk-score] Failed to refresh score for ${contactId}:`,
          error.message
        );
      }
    } catch (error: unknown) {
      console.warn(
        `[contact-risk-score] Unexpected error for ${contactId}:`,
        error instanceof Error ? error.message : error
      );
    }
  })();
}

export async function refreshContactRiskScore(
  supabase: SupabaseClient,
  contactId: string
): Promise<number | null> {
  const { data, error } = await supabase.rpc("calculate_contact_risk_score", {
    p_contact_id: contactId,
  });

  if (error) {
    throw new Error(error.message || "Failed to calculate contact risk score.");
  }

  return typeof data === "number" ? data : null;
}
