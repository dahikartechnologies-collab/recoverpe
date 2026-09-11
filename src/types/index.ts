export type WorkspaceMode = "personal" | "business";

export type SubscriptionPlan = "free" | "premium";

export type BusinessSubscriptionTier = "free" | "premium";

export type PaymentReliabilityTier =
  | "excellent"
  | "good"
  | "at_risk"
  | "defaulter";

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
  | "bad_debt_writeoff"
  | "wallet_advance";

export type PaymentMethod =
  | "upi_link"
  | "cash_manual"
  | "bank_transfer"
  | "cheque"
  | "system_adjustment";

export type CollectionMode =
  | "manual"
  | "virtual_account"
  | "upi_link"
  | "system";

export type CommunicationType =
  | "whatsapp_reminder"
  | "vapi_call"
  | "email_invoice"
  | "email_reminder";

export type CommunicationStatus =
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "call_completed";

export type CommunicationChannel = "whatsapp" | "sms" | "email" | "voice";

export type CommunicationDirection = "inbound" | "outbound";

export type ExpenseCategory =
  | "raw_material"
  | "transport_freight"
  | "rent"
  | "utilities"
  | "salaries"
  | "office_expense";

export type ExpensePaymentMode = "bank_transfer" | "upi" | "cash" | "cheque";

export type ReconciliationStatus = "pending_review" | "approved" | "rejected";

export interface RecoverpeUser {
  id: string;
  firebase_uid: string;
  email: string;
  phone_number: string;
  full_name?: string | null;
  billing_address?: string | null;
  alternate_phone?: string | null;
  default_upi_vpa?: string | null;
  subscription_plan: SubscriptionPlan;
  premium_expires_at?: string | null;
  recovery_upsell_shown?: boolean;
  vapi_wallet_balance: number;
  ledger_count: number;
  is_super_admin: boolean;
  account_status: AccountStatus;
  eligible_for_discount: boolean;
  created_at: string;
}

export interface BusinessNotificationPreferences {
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  auto_fallback: boolean;
}

export interface BusinessSmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from_name: string;
  from_email: string;
}

export interface Business {
  id: string;
  user_id: string;
  business_name: string;
  business_address: string | null;
  gstin: string | null;
  logo_url: string | null;
  msme_reg_no: string | null;
  invoice_prefix: string | null;
  financial_year_suffix: string | null;
  next_invoice_sequence: number;
  khata_auto_approve: boolean;
  subscription_tier: BusinessSubscriptionTier;
  ai_credits: number;
  autopilot_schedule?: number[];
  notification_preferences?: BusinessNotificationPreferences;
  smtp_settings?: BusinessSmtpSettings;
  created_at: string;
}

export interface ContactVirtualAccountDetails {
  virtual_account_id: string | null;
  virtual_upi_id: string | null;
  virtual_bank_account_number: string | null;
  virtual_ifsc_code: string | null;
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  phone_number: string;
  email: string | null;
  client_gstin: string | null;
  billing_address: string | null;
  wallet_balance?: number;
  risk_score?: number;
  predicted_pay_date?: string | null;
  payment_reliability_tier?: PaymentReliabilityTier;
  virtual_account_id?: string | null;
  virtual_upi_id?: string | null;
  virtual_bank_account_number?: string | null;
  virtual_ifsc_code?: string | null;
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
  communication_autopilot?: boolean;
  legal_escalation_ready?: boolean;
  legal_notice_pdf_url?: string | null;
  samadhaan_docket_pdf_url?: string | null;
  assigned_to_user_id?: string | null;
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
  risk_score?: number;
  payment_reliability_tier?: PaymentReliabilityTier;
  predicted_pay_date?: string | null;
}

export interface LedgerWithContact extends Ledger {
  contact: LedgerContactSummary;
}

export interface LedgerPagination {
  total: number;
  limit: number;
  offset: number;
  page: number;
  hasMore: boolean;
}

export interface LedgersResponse {
  ledgers: LedgerWithContact[];
  metrics: DashboardMetrics;
  pagination: LedgerPagination;
}

export interface CreateLedgerPayload {
  contact_name: string;
  phone_number: string;
  contact_email?: string | null;
  amount: number;
  due_date: string;
  generate_tax_invoice: boolean;
  upload_custom_pdf?: boolean;
  use_wallet_balance?: boolean;
  workspace_mode: WorkspaceMode;
  business_id?: string | null;
  client_gstin?: string | null;
  upi_vpa?: string | null;
}

export interface RectifyLedgerPayload {
  total_amount: number;
  due_date: string;
  rectification_reason: string;
  invoice_number?: string | null;
}

export interface MappedImportRow {
  contact_name: string;
  phone_number: string;
  amount: number;
  due_date: string;
  invoice_number?: string | null;
}

export interface BatchImportPayload {
  rows: MappedImportRow[];
  workspace_mode: WorkspaceMode;
  business_id?: string | null;
}

export interface BatchImportResponse {
  success: boolean;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  contact_count: number;
  message: string;
}

export type VapiSentimentBadge = "cooperative" | "evasive" | "hostile";

export interface CommunicationLog {
  id: string;
  // Nullable since migration 042: inbound replies map to a contact, not an invoice.
  ledger_id: string | null;
  user_id: string;
  business_id?: string | null;
  contact_id?: string | null;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  external_message_id?: string | null;
  summary?: string | null;
  type: CommunicationType;
  status: CommunicationStatus;
  cost_deducted: number;
  executed_at: string;
  recording_url?: string | null;
  sentiment?: VapiSentimentBadge | null;
  executive_summary?: string | null;
  vapi_call_id?: string | null;
  transcript?: string | null;
  duration_seconds?: number | null;
}

export interface Expense {
  id: string;
  user_id: string;
  business_id?: string | null;
  payee_name: string;
  amount: number;
  category: ExpenseCategory;
  payment_mode: ExpensePaymentMode;
  reference_number?: string | null;
  expense_date: string;
  notes?: string | null;
  created_at: string;
}

export interface Reconciliation {
  id: string;
  user_id: string;
  business_id?: string | null;
  contact_id?: string | null;
  ledger_id?: string | null;
  external_message_id?: string | null;
  media_id?: string | null;
  extracted_utr?: string | null;
  extracted_amount?: number | null;
  extracted_date?: string | null;
  raw_extraction?: unknown;
  status: ReconciliationStatus;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at: string;
}

export interface SendWhatsAppReminderPayload {
  ledger_id: string;
  upi_vpa?: string | null;
}

export interface SendLegalNoticeWhatsAppPayload {
  ledger_id: string;
}

export interface SendWhatsAppReminderResponse {
  success: boolean;
  simulated: boolean;
  message: string;
  channel?: "whatsapp" | "email";
  fallbackTriggered?: boolean;
  communication_log?: CommunicationLog;
  communication_type?: CommunicationType;
  draft?: {
    to: string;
    mode: WorkspaceMode;
    body: string;
  };
}

export interface PublicPayLedgerData {
  ledger_id: string;
  contact_name: string;
  business_name: string | null;
  invoice_number: string | null;
  balance_due: number;
  due_date: string;
  merchant_vpa: string;
  pdf_url: string | null;
}

export interface Transaction {
  id: string;
  ledger_id: string | null;
  contact_id?: string | null;
  transaction_type: TransactionType;
  amount: number;
  payment_method: PaymentMethod;
  collection_mode?: CollectionMode | null;
  reference_id: string | null;
  inbound_payment_id?: string | null;
  logged_at: string;
}

export interface WalletTransactionEntry {
  id: string;
  amount: number;
  transaction_type: TransactionType;
  payment_method: PaymentMethod;
  reference_id: string | null;
  logged_at: string;
}

export type AppRole =
  | "owner"
  | "admin"
  | "recovery_agent"
  | "accountant"
  | "field_staff";

export interface CustomPermissions {
  manage_team: boolean;
  edit_settings: boolean;
  edit_ledgers: boolean;
  send_reminders: boolean;
  export_data: boolean;
  spend_funds: boolean;
}

export const DEFAULT_CUSTOM_PERMISSIONS: CustomPermissions = {
  manage_team: false,
  edit_settings: false,
  edit_ledgers: false,
  send_reminders: false,
  export_data: false,
  spend_funds: false,
};

export const OWNER_CUSTOM_PERMISSIONS: CustomPermissions = {
  manage_team: true,
  edit_settings: true,
  edit_ledgers: true,
  send_reminders: true,
  export_data: true,
  spend_funds: true,
};

export type CustomPermissionKey = keyof CustomPermissions;

/** Runtime-checkable list of every capability key, for validating route gates. */
export const CUSTOM_PERMISSION_KEYS: CustomPermissionKey[] = [
  "manage_team",
  "edit_settings",
  "edit_ledgers",
  "send_reminders",
  "export_data",
  "spend_funds",
];

export function isCustomPermissionKey(
  value: string
): value is CustomPermissionKey {
  return (CUSTOM_PERMISSION_KEYS as string[]).includes(value);
}

export type InboundPaymentStatus =
  | "received"
  | "processing"
  | "allocated"
  | "partially_allocated"
  | "duplicate"
  | "failed";

/** Statuses that mean the event has already been fully handled. */
export const TERMINAL_INBOUND_PAYMENT_STATUSES: InboundPaymentStatus[] = [
  "allocated",
  "partially_allocated",
  "duplicate",
  "failed",
];

export interface WorkspaceRoleContext {
  role: AppRole;
  workspace_user_id: string | null;
  business_name: string | null;
  custom_permissions: CustomPermissions;
}

export interface CreateTransactionPayload {
  ledger_id?: string;
  contact_id?: string;
  amount: number;
  payment_method: "cash_manual" | "bank_transfer" | "cheque" | "upi_link";
  reference_id?: string | null;
}

export interface KioskVendorLedger {
  id: string;
  invoice_number: string | null;
  balance_due: number;
  due_date: string;
}

export interface KioskVendorAssignment {
  contact_id: string;
  contact_name: string;
  phone_number: string;
  business_id: string | null;
  total_outstanding: number;
  ledgers: KioskVendorLedger[];
}

export interface KioskAssignmentsResponse {
  business_name: string | null;
  vendors: KioskVendorAssignment[];
}

export interface WorkspaceMember {
  id: string;
  member_user_id: string;
  role: Exclude<AppRole, "owner">;
  email: string;
  full_name: string | null;
  phone_number: string;
  created_at: string;
  status: WorkspaceMemberStatus;
  invitee_name: string | null;
  custom_permissions: CustomPermissions;
}

export type WorkspaceMemberStatus = "pending" | "accepted" | "rejected";

export interface InviteWorkspaceMemberPayload {
  email: string;
  invitee_name: string;
  role: Exclude<AppRole, "owner">;
  custom_permissions?: CustomPermissions;
}

export interface WorkspaceInvitation {
  id: string;
  role: Exclude<AppRole, "owner">;
  created_at: string;
  workspace_user_id: string;
  business_name: string;
  invitee_name: string | null;
}

export interface WorkspaceInvitationsResponse {
  invitations: WorkspaceInvitation[];
}

export interface LedgerNote {
  id: string;
  ledger_id: string;
  user_id: string;
  note_text: string;
  created_at: string;
  author_name: string;
}

export interface LedgerNotesResponse {
  notes: LedgerNote[];
}

export interface WorkspaceMembersResponse {
  members: WorkspaceMember[];
}

export interface AccessibleBusinessOption {
  business_id: string;
  business_name: string;
  workspace_user_id: string;
  workspace_label: string;
  context_label: string;
  role: AppRole;
  is_own_workspace: boolean;
}

export interface AccessibleWorkspacesResponse {
  options: AccessibleBusinessOption[];
  unique_workspace_count: number;
}

export interface AssignVendorAgentPayload {
  assigned_to_user_id: string | null;
  business_id?: string | null;
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

export type PurchaseType =
  | "subscription_premium"
  | "subscription_premium_annual"
  | "vapi_recharge_100"
  | "legal_notice_999"
  | "samadhaan_499";

export type SubscriptionPurchaseType =
  | "subscription_premium"
  | "subscription_premium_annual";

export interface CreateRazorpayOrderPayload {
  purchase_type: Exclude<PurchaseType, SubscriptionPurchaseType>;
  ledger_id?: string;
}

export interface CreateRazorpaySubscriptionPayload {
  purchase_type: SubscriptionPurchaseType;
}

export interface CreateRazorpaySubscriptionResponse {
  success: boolean;
  simulated: boolean;
  subscription: {
    id: string;
    plan_id: string;
    status: string;
    current_end?: number;
    short_url?: string;
  };
  key: string | null;
  purchase_type: SubscriptionPurchaseType;
  message: string;
  amount_paise?: number;
  discount_applied?: boolean;
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
  amount_paise?: number;
  discount_applied?: boolean;
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
  micro_fulfillment?: MicroTransactionFulfillment | null;
}

export interface SamadhaanFilingMeta {
  claimant_gstin: string | null;
  debtor_gstin: string | null;
  debtor_name: string;
  invoice_number: string | null;
  invoice_date: string;
  total_outstanding: number;
  balance_due: number;
}

export interface MicroTransactionFulfillment {
  purchase_type: Extract<PurchaseType, "legal_notice_999" | "samadhaan_499">;
  ledger_id: string;
  pdf_url: string;
  samadhaan_meta?: SamadhaanFilingMeta;
}

export interface FulfillRazorpayOrderPayload {
  order_id: string;
}

export interface FulfillRazorpayOrderResponse {
  success: boolean;
  purchase_type: PurchaseType;
  micro_fulfillment?: MicroTransactionFulfillment | null;
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

export type RazorpayOrderStatus = "created" | "paid" | "failed";

export interface AdminRazorpayOrder {
  id: string;
  user_id: string;
  user_email: string | null;
  razorpay_order_id: string;
  purchase_type: string;
  amount_paise: number;
  status: RazorpayOrderStatus;
  ledger_id: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface AdminOrdersListResponse {
  orders: AdminRazorpayOrder[];
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

export interface ContactDirectoryEntry {
  contact_id: string;
  contact_name: string;
  phone_number: string;
  wallet_balance: number;
  open_invoice_count: number;
  net_outstanding: number;
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_90_plus: number;
}

export interface VendorPagination {
  total: number;
  limit: number;
  offset: number;
  page: number;
  hasMore: boolean;
}

export interface ContactDirectoryResponse {
  contacts: ContactDirectoryEntry[];
  pagination: VendorPagination;
}

export type WorkspaceSearchResultType = "Contact" | "Ledger";

export interface WorkspaceSearchResult {
  type: WorkspaceSearchResultType;
  id: string;
  title: string;
  subtitle: string;
  contact_id?: string;
  invoice_number?: string | null;
  balance_due?: number;
  due_date?: string;
}

export interface WorkspaceSearchResponse {
  results: WorkspaceSearchResult[];
}

export interface VendorDetailResponse {
  contact: ContactDirectoryEntry;
  ledgers: LedgerWithContact[];
  wallet_transactions: WalletTransactionEntry[];
  pagination: VendorPagination;
  virtual_account: VirtualAccount | null;
  contact_virtual_account: ContactVirtualAccountDetails | null;
  business_id: string | null;
  business_name: string | null;
  wallet_balance: number;
}

export interface AutopilotEscalationAlert {
  ledger_id: string;
  contact_name: string;
  balance_due: number;
  due_date: string;
  invoice_number: string | null;
}

export interface VirtualAccount {
  id: string;
  user_id: string;
  business_id: string;
  contact_id: string;
  provider: "razorpay" | "cashfree";
  virtual_upi_id: string | null;
  virtual_account_number: string | null;
  ifsc_code: string | null;
  provider_reference_id: string | null;
  status: "active" | "suspended" | "closed";
  created_at: string;
  updated_at: string;
}

export interface DebtorPortalInvoice {
  id: string;
  invoice_number: string | null;
  balance_due: number;
  due_date: string;
  status: string;
}

export interface DebtorPortalView {
  session_id: string;
  merchant_name: string;
  contact_name: string;
  total_outstanding: number;
  expires_at: string;
  virtual_upi_id: string | null;
  virtual_account_number: string | null;
  ifsc_code: string | null;
  open_invoices: DebtorPortalInvoice[];
}

export interface PortalLinkResponse {
  url: string;
  session_id: string;
  expires_at: string;
}

export interface ProvisionVirtualAccountResponse {
  virtual_account: VirtualAccount;
  simulated: boolean;
}

export type EvidenceFileType = "POD" | "Contract" | "Photo" | "Invoice" | "Other";

export interface EvidenceAttachment {
  id: string;
  ledger_id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  file_type: EvidenceFileType;
  uploaded_at: string;
}

export interface EvidenceVaultResponse {
  attachments: EvidenceAttachment[];
}

export type PendingOnboardStatus = "pending" | "approved" | "rejected";

export interface PendingOnboard {
  id: string;
  business_id: string;
  customer_name: string;
  customer_phone: string;
  amount: number;
  status: PendingOnboardStatus;
  created_at: string;
}

export interface PendingOnboardsResponse {
  pending_onboards: PendingOnboard[];
  khata_auto_approve: boolean;
}

export interface ApprovePendingOnboardResponse {
  pending_onboard: PendingOnboard;
  ledger_id: string;
  contact_id: string;
}

export interface PublicOnboardPayload {
  business_id: string;
  name: string;
  phone: string;
  amount: number;
}

export interface PublicKhataPaymentDetails {
  virtual_upi_id: string | null;
  payee_name: string;
}

export interface PublicOnboardResponse {
  success: boolean;
  auto_approved: boolean;
  amount: number;
  business_name: string;
  pending_onboard_id?: string;
  ledger_id?: string;
  contact_id?: string;
  payment: PublicKhataPaymentDetails | null;
}

export type DiagnosticServiceStatus = "ok" | "failed";

export interface DiagnosticsHealthResponse {
  status: "ok" | "degraded";
  services: {
    supabase: DiagnosticServiceStatus;
    firebase: DiagnosticServiceStatus;
    redis: DiagnosticServiceStatus;
    razorpay: DiagnosticServiceStatus;
  };
  checked_at: string;
}

export interface SimulatePaymentPayload {
  contact_id: string;
  amount_rupees: number;
  payment_id?: string;
}
