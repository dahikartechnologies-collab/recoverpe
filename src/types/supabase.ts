/**
 * Partial Supabase schema types for Master Sprint tables/columns.
 * Regenerate fully with: npx supabase gen types typescript --local > src/types/supabase.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DbAppRole =
  | "owner"
  | "admin"
  | "recovery_agent"
  | "accountant"
  | "field_staff"
  | "viewer";

export interface AuditLogRow {
  id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Json;
  created_at: string;
}

export interface AuditLogInsert {
  id?: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  metadata?: Json;
  created_at?: string;
}

export interface Database {
  public: {
    Tables: {
      audit_logs: {
        Row: AuditLogRow;
        Insert: AuditLogInsert;
        Update: Partial<AuditLogInsert>;
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: DbAppRole;
    };
    CompositeTypes: Record<string, never>;
  };
}
