import { SupabaseClient } from "@supabase/supabase-js";
import type { AuditLogInsert, Json } from "@/types/supabase";

export interface AuditLogInput {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(
  supabase: SupabaseClient,
  input: AuditLogInput
): Promise<void> {
  const row: AuditLogInsert = {
    actor_id: input.actorId,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    metadata: (input.metadata ?? {}) as Json,
  };

  const { error } = await supabase.from("audit_logs").insert(row);

  if (error) {
    console.error("[audit-logs] failed to write audit log", {
      action: input.action,
      resourceType: input.resourceType,
      message: error.message,
    });
  }
}
