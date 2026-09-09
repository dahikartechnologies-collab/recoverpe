"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ChartTooltip, ChartTooltipRow } from "@/components/dashboard/analytics/ChartTooltip";
import {
  CASH_FLOW_COLORS,
  CHART_AXIS_STYLE,
  CHART_GRID_STROKE,
  FINTECH_PALETTE,
} from "@/components/dashboard/analytics/chart-theme";
import { formatCurrency } from "@/lib/gst";
import { DashboardCashFlowPoint } from "@/lib/dashboard-analytics";

interface CashFlowChartProps {
  data: DashboardCashFlowPoint[];
  isLoading?: boolean;
}

function formatAxisValue(value: number): string {
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }

  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(0)}K`;
  }

  return `₹${value}`;
}

interface CashFlowTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    dataKey?: string;
  }>;
  label?: string;
}

function CashFlowTooltip({ active, payload, label }: CashFlowTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const colorByKey: Record<string, string> = {
    expected: CASH_FLOW_COLORS.expected,
    collected: CASH_FLOW_COLORS.collected,
  };

  return (
    <ChartTooltip title={label}>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <ChartTooltipRow
            key={entry.dataKey ?? entry.name}
            label={entry.name ?? ""}
            value={formatCurrency(entry.value ?? 0)}
            color={colorByKey[entry.dataKey ?? ""]}
          />
        ))}
      </div>
    </ChartTooltip>
  );
}

function renderLegendText(value: string) {
  const color =
    value === "Expected"
      ? CASH_FLOW_COLORS.expected
      : value === "Collected"
        ? CASH_FLOW_COLORS.collected
        : FINTECH_PALETTE.obsidian;

  return (
    <span style={{ color: FINTECH_PALETTE.obsidian, fontSize: "11px" }}>
      <span
        className="mr-1.5 inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {value}
    </span>
  );
}

const BRUSH_STROKE = FINTECH_PALETTE.axis;
const BRUSH_FILL = "#0F172A";

export function CashFlowChart({ data, isLoading = false }: CashFlowChartProps) {
  const brushStartIndex = useMemo(
    () => Math.max(0, data.length - 6),
    [data.length]
  );

  return (
    <Card className="h-full min-w-0">
      <CardHeader className="border-b border-recoverpe-grey-light px-5 py-4">
        <p className="type-eyebrow">Cash flow</p>
        <h2 className="mt-1 text-base font-semibold text-recoverpe-black">
          Invoiced vs collected
        </h2>
        <p className="mt-1 text-xs text-recoverpe-grey-medium">
          Twelve-month invoiced volume compared to payments received. Drag the
          brush below to zoom into a date range.
        </p>
      </CardHeader>
      <CardContent className="px-2 pb-4 pt-2 sm:px-4">
        {isLoading ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-recoverpe-grey-medium">
            Loading chart...
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-recoverpe-grey-medium">
            No cash flow data yet.
          </div>
        ) : (
          <div className="h-[320px] w-full min-w-0 touch-pan-x">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="expectedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={CASH_FLOW_COLORS.expected}
                      stopOpacity={0.45}
                    />
                    <stop
                      offset="100%"
                      stopColor={CASH_FLOW_COLORS.expected}
                      stopOpacity={0.04}
                    />
                  </linearGradient>
                  <linearGradient id="collectedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={CASH_FLOW_COLORS.collected}
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="100%"
                      stopColor={CASH_FLOW_COLORS.collected}
                      stopOpacity={0.08}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke={CHART_GRID_STROKE}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={CHART_AXIS_STYLE}
                  axisLine={{ stroke: CHART_GRID_STROKE }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={CHART_AXIS_STYLE}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxisValue}
                  width={52}
                />
                <Tooltip content={<CashFlowTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="plainline"
                  formatter={renderLegendText}
                  wrapperStyle={{ paddingBottom: "8px" }}
                />
                <Area
                  type="monotone"
                  dataKey="expected"
                  name="Expected"
                  stroke={CASH_FLOW_COLORS.expected}
                  strokeWidth={2}
                  fill="url(#expectedFill)"
                  fillOpacity={0.8}
                  dot={false}
                  isAnimationActive
                  activeDot={{ r: 4, fill: CASH_FLOW_COLORS.expected, strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="collected"
                  name="Collected"
                  stroke={CASH_FLOW_COLORS.collected}
                  strokeWidth={2}
                  fill="url(#collectedFill)"
                  fillOpacity={0.8}
                  dot={false}
                  isAnimationActive
                  activeDot={{ r: 4, fill: CASH_FLOW_COLORS.collected, strokeWidth: 0 }}
                />
                <Brush
                  dataKey="month"
                  height={28}
                  stroke={BRUSH_STROKE}
                  fill={BRUSH_FILL}
                  fillOpacity={0.9}
                  travellerWidth={8}
                  startIndex={brushStartIndex}
                  endIndex={Math.max(brushStartIndex, data.length - 1)}
                  tickFormatter={(value) =>
                    typeof value === "string" ? value.replace(/\s+\d{4}$/, "") : value
                  }
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
