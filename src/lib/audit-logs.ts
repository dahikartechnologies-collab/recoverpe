import { SupabaseClient } from "@supabase/supabase-js";

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
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: input.actorId,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("[audit-logs] failed to write audit log", {
      action: input.action,
      resourceType: input.resourceType,
      message: error.message,
    });
  }
}
