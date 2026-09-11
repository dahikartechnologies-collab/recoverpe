import { EMPTY_DASHBOARD_ANALYTICS, DashboardAnalytics } from "@/lib/dashboard-analytics";
import { ReconciliationActivityItem } from "@/lib/dashboard-activity-feed";
import { DashboardIntelligence } from "@/lib/dashboard-intelligence-client";
import { LEDGER_PAGE_SIZE } from "@/lib/ledger-queries";
import { DashboardMetrics, LedgerPagination, LedgerWithContact } from "@/types";

export interface DashboardHomePayload {
  analytics: DashboardAnalytics;
  intelligence: DashboardIntelligence;
  activity: ReconciliationActivityItem[];
  ledgers: LedgerWithContact[];
  metrics: DashboardMetrics;
  pagination: LedgerPagination;
}

const EMPTY_INTELLIGENCE: DashboardIntelligence = {
  wall_of_shame: [],
  hostile_calls: [],
  pending_verifications: [],
};

const EMPTY_METRICS: DashboardMetrics = {
  totalOutstanding: 0,
  severelyOverdue: 0,
  recoveredViaRecoverpe: 0,
};

const EMPTY_PAGINATION: LedgerPagination = {
  total: 0,
  limit: LEDGER_PAGE_SIZE,
  offset: 0,
  page: 1,
  hasMore: false,
};

export const EMPTY_DASHBOARD_HOME: DashboardHomePayload = {
  analytics: EMPTY_DASHBOARD_ANALYTICS,
  intelligence: EMPTY_INTELLIGENCE,
  activity: [],
  ledgers: [],
  metrics: EMPTY_METRICS,
  pagination: EMPTY_PAGINATION,
};
