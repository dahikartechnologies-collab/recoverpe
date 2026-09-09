/** Corporate FinTech palette for analytics visualizations */
export const FINTECH_PALETTE = {
  navy: "#1E3A8A",
  teal: "#0F766E",
  emerald: "#059669",
  gold: "#D97706",
  coral: "#EF4444",
  obsidian: "#334155",
  white: "#FFFFFF",
  grid: "#E2E8F0",
  axis: "#94A3B8",
} as const;

export const CASH_FLOW_COLORS = {
  expected: FINTECH_PALETTE.navy,
  collected: FINTECH_PALETTE.teal,
} as const;

export const AGING_BUCKET_COLORS = {
  "0-30": FINTECH_PALETTE.emerald,
  "31-60": FINTECH_PALETTE.gold,
  "61+": FINTECH_PALETTE.coral,
} as const;

export type AgingBucketKey = keyof typeof AGING_BUCKET_COLORS;

export function getAgingBucketColor(key: string): string {
  if (key in AGING_BUCKET_COLORS) {
    return AGING_BUCKET_COLORS[key as AgingBucketKey];
  }

  return FINTECH_PALETTE.obsidian;
}

export const CHART_AXIS_STYLE = {
  fontSize: 11,
  fill: FINTECH_PALETTE.axis,
};

export const CHART_GRID_STROKE = FINTECH_PALETTE.grid;

export const CHART_TOOLTIP_CLASSNAME =
  "rounded-lg border border-slate-200/80 bg-white px-3 py-2.5 shadow-md";
