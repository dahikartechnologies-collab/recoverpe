export type WorkspaceMode = "personal" | "business";

export type SubscriptionPlan = "free" | "premium";

export type AccountStatus = "active" | "suspended" | "pending_purge";

export type LedgerSourceType =
  | "tally_import"
  | "system_generated"
  | "manual_entry";

export type LedgerStatus =
  | "draft"
  | "pending"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "refunded";

export type TransactionType =
  | "payment_received"
  | "refund_issued"
  | "credit_note_applied"
  | "bad_debt_writeoff";

export type PaymentMethod =
  | "upi_link"
  | "cash_manual"
  | "bank_transfer"
  | "cheque"
  | "system_adjustment";

export type CommunicationType =
  | "whatsapp_reminder"
  | "vapi_call"
  | "email_invoice";

export type CommunicationStatus =
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "call_completed";

export interface RecoverpeUser {
  id: string;
  firebase_uid: string;
  email: string;
  phone_number: string;
  subscription_plan: SubscriptionPlan;
  vapi_wallet_balance: number;
  ledger_count: number;
  is_super_admin: boolean;
  account_status: AccountStatus;
  eligible_for_discount: boolean;
  created_at: string;
}

export interface Business {
  id: string;
  user_id: string;
  business_name: string;
  gstin: string | null;
  logo_url: string | null;
  invoice_prefix: string | null;
  financial_year_suffix: string | null;
  next_invoice_sequence: number;
  created_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  phone_number: string;
  client_gstin: string | null;
  billing_address: string | null;
  created_at: string;
}

export interface Ledger {
  id: string;
  user_id: string;
  contact_id: string;
  business_id: string | null;
  invoice_number: string | null;
  source_type: LedgerSourceType;
  total_amount: number;
  balance_due: number;
  due_date: string;
  status: LedgerStatus;
  is_custom_pdf: boolean;
  pdf_url: string | null;
  current_version: number;
  communication_paused: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBusinessPayload {
  business_name: string;
  gstin?: string | null;
  logo_url?: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  phoneNumber: string | null;
  displayName: string | null;
  createdAt: string;
}

export interface Workspace {
  id: string;
  ownerId: string;
  name: string;
  mode: WorkspaceMode;
  createdAt: string;
}

export interface SyncUserPayload {
  firebase_uid: string;
  email: string;
  phone_number: string;
}

export interface DashboardMetrics {
  totalOutstanding: number;
  severelyOverdue: number;
  recoveredViaRecoverpe: number;
}

export interface LedgerContactSummary {
  name: string;
  phone_number: string;
}

export interface LedgerWithContact extends Ledger {
  contact: LedgerContactSummary;
}

export interface LedgersResponse {
  ledgers: LedgerWithContact[];
  metrics: DashboardMetrics;
}

export interface CreateLedgerPayload {
  contact_name: string;
  phone_number: string;
  amount: number;
  due_date: string;
  generate_tax_invoice: boolean;
  workspace_mode: WorkspaceMode;
  business_id?: string | null;
  client_gstin?: string | null;
  upi_vpa?: string | null;
}

export interface MappedImportRow {
  contact_name: string;
  phone_number: string;
  amount: number;
  due_date: string;
}

export interface BatchImportPayload {
  rows: MappedImportRow[];
  workspace_mode: WorkspaceMode;
  business_id?: string | null;
}

export interface BatchImportResponse {
  success: boolean;
  imported_count: number;
  skipped_count: number;
  contact_count: number;
  message: string;
}

export interface CommunicationLog {
  id: string;
  ledger_id: string;
  type: CommunicationType;
  status: CommunicationStatus;
  cost_deducted: number;
  executed_at: string;
}

export interface SendWhatsAppReminderPayload {
  ledger_id: string;
  upi_vpa?: string | null;
}

export interface SendWhatsAppReminderResponse {
  success: boolean;
  simulated: boolean;
  message: string;
  communication_log: CommunicationLog;
  draft: {
    to: string;
    mode: WorkspaceMode;
    body: string;
  };
}

export interface Transaction {
  id: string;
  ledger_id: string;
  transaction_type: TransactionType;
  amount: number;
  payment_method: PaymentMethod;
  reference_id: string | null;
  logged_at: string;
}

export interface CreateTransactionPayload {
  ledger_id: string;
  amount: number;
  payment_method: "cash_manual" | "bank_transfer";
  reference_id?: string | null;
}

export interface UpdateLedgerPayload {
  communication_paused: boolean;
}

export interface InitiateVapiCallPayload {
  ledger_id: string;
}

export interface InitiateVapiCallResponse {
  success: boolean;
  simulated: boolean;
  message: string;
  vapi_call_id: string | null;
  vapi_wallet_balance: number;
  communication_log: CommunicationLog;
  draft: {
    customer_number: string;
    context: {
      business_name: string;
      debtor_name: string;
      balance_due: number;
      balance_due_label: string;
      days_overdue: number;
      due_date: string;
      invoice_number: string | null;
      ledger_id: string;
    };
    system_prompt: string;
    first_message: string;
  };
}

export type PurchaseType = "subscription_premium" | "vapi_recharge_100";

export interface CreateRazorpayOrderPayload {
  purchase_type: PurchaseType;
}

export interface CreateRazorpayOrderResponse {
  success: boolean;
  simulated: boolean;
  order: {
    id: string;
    amount: number;
    currency: string;
    receipt: string;
  };
  key: string | null;
  purchase_type: PurchaseType;
  message: string;
}

export interface DevFulfillRazorpayPayload {
  order_id: string;
}

export interface DevFulfillRazorpayResponse {
  success: boolean;
  simulated: boolean;
  purchase_type: PurchaseType;
  subscription_plan: SubscriptionPlan;
  vapi_wallet_balance: number;
  message: string;
}

export interface AdminPlatformMetrics {
  total_registered_users: number;
  total_business_profiles: number;
  total_premium_subscriptions: number;
  total_ledgers: number;
}

export interface AdminRecentUser {
  id: string;
  name: string;
  email: string;
  subscription_plan: SubscriptionPlan;
  created_at: string;
}

export interface AdminMetricsResponse {
  metrics: AdminPlatformMetrics;
  recent_users: AdminRecentUser[];
}

export type AdminUserManageAction = "suspend" | "unsuspend" | "grant_discount";

export interface AdminManageUserPayload {
  user_id: string;
  action: AdminUserManageAction;
}

export interface AdminManagedUser {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  subscription_plan: SubscriptionPlan;
  account_status: AccountStatus;
  eligible_for_discount: boolean;
  is_super_admin: boolean;
  created_at: string;
}

export interface AdminUsersListResponse {
  users: AdminManagedUser[];
}

export interface AdminManageUserResponse {
  success: boolean;
  user: AdminManagedUser;
  message: string;
}

export interface GhostModeInfo {
  active: boolean;
  impersonated_user_id: string | null;
  impersonated_user_email: string | null;
}

export interface CurrentUserResponse {
  user: RecoverpeUser;
  ghost_mode: GhostModeInfo;
}
