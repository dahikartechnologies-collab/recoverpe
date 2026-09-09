import { daysBetweenDateOnly, getTodayDateStringInIst } from "@/lib/timezone";
import { LedgerStatus } from "@/types";

const EXCLUDED_STATUSES: LedgerStatus[] = ["paid", "cancelled", "refunded"];

export interface AnalyticsSankeyLedgerRow {
  id: string;
  total_amount: number | string;
  balance_due: number | string;
  due_date: string;
  status: LedgerStatus;
  legal_notice_pdf_url?: string | null;
  samadhaan_docket_pdf_url?: string | null;
}

export interface SankeyLinkDatum {
  source: number;
  target: number;
  value: number;
  color: string;
}

export interface SankeyFlowData {
  nodes: Array<{ name: string; color: string }>;
  links: SankeyLinkDatum[];
}

export const SANKEY_NODE_INDEX = {
  totalInvoiced: 0,
  collectedOnTime: 1,
  overdue: 2,
  days0_30: 3,
  days31_60: 4,
  days60Plus: 5,
  legalSamadhaan: 6,
  unrecovered: 7,
} as const;

export const SANKEY_LINK_COLORS = {
  collected: "#0F766E",
  pending: "#D97706",
  critical: "#EF4444",
  navy: "#1E3A8A",
} as const;

function addLink(
  links: SankeyLinkDatum[],
  source: number,
  target: number,
  value: number,
  color: string
) {
  if (value <= 0) {
    return;
  }

  links.push({ source, target, value: Math.round(value), color });
}

/** Transforms raw ledger rows into a Recharts Sankey money-river dataset. */
export function buildSankeyFlowFromLedgers(
  ledgers: AnalyticsSankeyLedgerRow[],
  referenceDate = new Date()
): SankeyFlowData {
  const today = getTodayDateStringInIst(referenceDate);
  const nodes = [
    { name: "Total Invoiced", color: SANKEY_LINK_COLORS.navy },
    { name: "Collected On Time", color: SANKEY_LINK_COLORS.collected },
    { name: "Overdue", color: SANKEY_LINK_COLORS.pending },
    { name: "0–30 Days", color: SANKEY_LINK_COLORS.pending },
    { name: "31–60 Days", color: SANKEY_LINK_COLORS.pending },
    { name: "60+ Days", color: SANKEY_LINK_COLORS.critical },
    { name: "Legal / Samadhaan", color: SANKEY_LINK_COLORS.critical },
    { name: "Unrecovered", color: SANKEY_LINK_COLORS.critical },
  ];

  let collectedOnTime = 0;
  let bucket0_30 = 0;
  let bucket31_60 = 0;
  let bucket60Plus = 0;
  let legalSamadhaan = 0;
  let unrecovered = 0;

  for (const ledger of ledgers) {
    if (EXCLUDED_STATUSES.includes(ledger.status)) {
      continue;
    }

    const totalAmount = Number(ledger.total_amount);
    const balanceDue = Number(ledger.balance_due);
    const collectedAmount = Math.max(0, totalAmount - balanceDue);

    collectedOnTime += collectedAmount;

    if (balanceDue <= 0) {
      continue;
    }

    const daysOverdue = Math.max(0, daysBetweenDateOnly(ledger.due_date, today));

    if (daysOverdue <= 30) {
      bucket0_30 += balanceDue;
    } else if (daysOverdue <= 60) {
      bucket31_60 += balanceDue;
    } else {
      bucket60Plus += balanceDue;

      if (ledger.legal_notice_pdf_url || ledger.samadhaan_docket_pdf_url) {
        legalSamadhaan += balanceDue;
      } else {
        unrecovered += balanceDue;
      }
    }
  }

  const overdueTotal = bucket0_30 + bucket31_60 + bucket60Plus;
  const links: SankeyLinkDatum[] = [];

  addLink(
    links,
    SANKEY_NODE_INDEX.totalInvoiced,
    SANKEY_NODE_INDEX.collectedOnTime,
    collectedOnTime,
    SANKEY_LINK_COLORS.collected
  );
  addLink(
    links,
    SANKEY_NODE_INDEX.totalInvoiced,
    SANKEY_NODE_INDEX.overdue,
    overdueTotal,
    SANKEY_LINK_COLORS.pending
  );
  addLink(
    links,
    SANKEY_NODE_INDEX.overdue,
    SANKEY_NODE_INDEX.days0_30,
    bucket0_30,
    SANKEY_LINK_COLORS.pending
  );
  addLink(
    links,
    SANKEY_NODE_INDEX.overdue,
    SANKEY_NODE_INDEX.days31_60,
    bucket31_60,
    SANKEY_LINK_COLORS.pending
  );
  addLink(
    links,
    SANKEY_NODE_INDEX.overdue,
    SANKEY_NODE_INDEX.days60Plus,
    bucket60Plus,
    SANKEY_LINK_COLORS.critical
  );
  addLink(
    links,
    SANKEY_NODE_INDEX.days60Plus,
    SANKEY_NODE_INDEX.legalSamadhaan,
    legalSamadhaan,
    SANKEY_LINK_COLORS.critical
  );
  addLink(
    links,
    SANKEY_NODE_INDEX.days60Plus,
    SANKEY_NODE_INDEX.unrecovered,
    unrecovered,
    SANKEY_LINK_COLORS.critical
  );

  return { nodes, links };
}
