/**
 * Partial Supabase schema types for Master Sprint tables/columns.
 * Regenerate fully with: npx supabase gen types typescript --local > src/types/supabase.ts
 * Sprint 96 rows were added by hand because this machine has no local Postgres.
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

export interface MerchantBankAccountRow {
  id: string;
  business_id: string;
  account_type?: "business" | "personal";
  is_primary?: boolean;
  account_number: string | null;
  ifsc: string | null;
  upi_vpa: string | null;
  is_verified: boolean;
  verification_payment_id: string | null;
  created_at: string;
}

export interface MerchantBankAccountInsert {
  id?: string;
  business_id: string;
  account_type?: "business" | "personal";
  is_primary?: boolean;
  account_number?: string | null;
  ifsc?: string | null;
  upi_vpa?: string | null;
  is_verified?: boolean;
  verification_payment_id?: string | null;
  created_at?: string;
}

export type PurchaseVoucherStatus = "draft" | "posted" | "cancelled";
export type StockMovementDirection = "in" | "out";
export type StockMovementSource = "parchi" | "voice" | "manual" | "sale";
export type DocumentCaptureStatus = "pending" | "reviewed" | "rejected";
export type VoiceCommandStatus = "pending" | "executed" | "failed";

export interface StockItemRow {
  id: string;
  business_id: string;
  name: string;
  unit: string;
  hsn: string | null;
  gst_rate: number;
  reorder_level: number;
  qty_on_hand: number;
  last_cost: number;
  selling_price: number;
  created_at: string;
  updated_at: string;
}

export interface StockItemInsert {
  id?: string;
  business_id: string;
  name: string;
  unit: string;
  hsn?: string | null;
  gst_rate?: number;
  reorder_level?: number;
  qty_on_hand?: number;
  last_cost?: number;
  selling_price?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseVoucherRow {
  id: string;
  business_id: string;
  supplier_name: string;
  bill_date: string;
  credit_amount: number;
  status: PurchaseVoucherStatus;
  created_at: string;
  updated_at: string;
}

export interface PurchaseVoucherInsert {
  id?: string;
  business_id: string;
  supplier_name: string;
  bill_date: string;
  credit_amount: number;
  status?: PurchaseVoucherStatus;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseVoucherLineRow {
  id: string;
  business_id: string;
  voucher_id: string;
  stock_item_id: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseVoucherLineInsert {
  id?: string;
  business_id: string;
  voucher_id: string;
  stock_item_id: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
  created_at?: string;
  updated_at?: string;
}

export interface StockMovementRow {
  id: string;
  business_id: string;
  item_id: string;
  direction: StockMovementDirection;
  qty: number;
  rate: number;
  source: StockMovementSource;
  reference_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockMovementInsert {
  id?: string;
  business_id: string;
  item_id: string;
  direction: StockMovementDirection;
  qty: number;
  rate: number;
  source: StockMovementSource;
  reference_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DocumentCaptureRow {
  id: string;
  business_id: string;
  photo_url: string;
  raw_ai_json: Json;
  confidence_score: number;
  status: DocumentCaptureStatus;
  created_at: string;
  updated_at: string;
}

export interface DocumentCaptureInsert {
  id?: string;
  business_id: string;
  photo_url: string;
  raw_ai_json?: Json;
  confidence_score?: number;
  status?: DocumentCaptureStatus;
  created_at?: string;
  updated_at?: string;
}

export interface VoiceCommandRow {
  id: string;
  business_id: string;
  transcript: string;
  intent: string;
  parsed_payload: Json;
  status: VoiceCommandStatus;
  created_at: string;
  updated_at: string;
}

export interface VoiceCommandInsert {
  id?: string;
  business_id: string;
  transcript: string;
  intent: string;
  parsed_payload?: Json;
  status?: VoiceCommandStatus;
  created_at?: string;
  updated_at?: string;
}

export interface Database {
  public: {
    Tables: {
      merchant_bank_accounts: {
        Row: MerchantBankAccountRow;
        Insert: MerchantBankAccountInsert;
        Update: Partial<MerchantBankAccountInsert>;
        Relationships: [
          {
            foreignKeyName: "merchant_bank_accounts_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
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
      stock_items: {
        Row: StockItemRow;
        Insert: StockItemInsert;
        Update: Partial<StockItemInsert>;
        Relationships: [
          {
            foreignKeyName: "stock_items_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_vouchers: {
        Row: PurchaseVoucherRow;
        Insert: PurchaseVoucherInsert;
        Update: Partial<PurchaseVoucherInsert>;
        Relationships: [
          {
            foreignKeyName: "purchase_vouchers_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_voucher_lines: {
        Row: PurchaseVoucherLineRow;
        Insert: PurchaseVoucherLineInsert;
        Update: Partial<PurchaseVoucherLineInsert>;
        Relationships: [
          {
            foreignKeyName: "purchase_voucher_lines_voucher_id_fkey";
            columns: ["voucher_id"];
            isOneToOne: false;
            referencedRelation: "purchase_vouchers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_voucher_lines_stock_item_id_fkey";
            columns: ["stock_item_id"];
            isOneToOne: false;
            referencedRelation: "stock_items";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: StockMovementRow;
        Insert: StockMovementInsert;
        Update: Partial<StockMovementInsert>;
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "stock_items";
            referencedColumns: ["id"];
          },
        ];
      };
      document_captures: {
        Row: DocumentCaptureRow;
        Insert: DocumentCaptureInsert;
        Update: Partial<DocumentCaptureInsert>;
        Relationships: [
          {
            foreignKeyName: "document_captures_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      voice_commands: {
        Row: VoiceCommandRow;
        Insert: VoiceCommandInsert;
        Update: Partial<VoiceCommandInsert>;
        Relationships: [
          {
            foreignKeyName: "voice_commands_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
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
