"use client";

import { ReactNode } from "react";
import { CHART_TOOLTIP_CLASSNAME } from "@/components/dashboard/analytics/chart-theme";

interface ChartTooltipProps {
  title?: string;
  children: ReactNode;
}

export function ChartTooltip({ title, children }: ChartTooltipProps) {
  return (
    <div className={CHART_TOOLTIP_CLASSNAME}>
      {title ? (
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}

interface ChartTooltipRowProps {
  label: string;
  value: string;
  color?: string;
}

export function ChartTooltipRow({ label, value, color }: ChartTooltipRowProps) {
  return (
    <div className="flex items-center justify-between gap-6 text-xs text-slate-900">
      <span className="flex items-center gap-2">
        {color ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
        ) : null}
        <span>{label}</span>
      </span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
