"use client";

import { useId, useMemo } from "react";
import { Layer, Rectangle, ResponsiveContainer, Sankey, Tooltip } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { ChartTooltip, ChartTooltipRow } from "@/components/dashboard/analytics/ChartTooltip";
import { FINTECH_PALETTE } from "@/components/dashboard/analytics/chart-theme";
import { formatCurrency } from "@/lib/gst";
import { SankeyFlowData } from "@/lib/analytics-sankey";

interface ArSankeyFlowProps {
  data: SankeyFlowData;
  isLoading?: boolean;
}

interface SankeyLinkRenderProps {
  sourceX: number;
  sourceY: number;
  sourceControlX: number;
  targetX: number;
  targetY: number;
  targetControlX: number;
  linkWidth: number;
  index: number;
  payload?: {
    value?: number;
    color?: string;
  };
}

interface SankeyNodeRenderProps {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload?: {
    name?: string;
    color?: string;
  };
}

interface SankeyTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload?: {
      source?: { name?: string };
      target?: { name?: string };
      value?: number;
      color?: string;
    };
  }>;
}

function SankeyFlowTooltip({ active, payload }: SankeyTooltipProps) {
  if (!active || !payload?.[0]?.payload) {
    return null;
  }

  const link = payload[0].payload;
  const sourceName = link.source?.name ?? "Source";
  const targetName = link.target?.name ?? "Target";

  return (
    <ChartTooltip title={`${sourceName} → ${targetName}`}>
      <ChartTooltipRow
        label="Flow amount"
        value={formatCurrency(link.value ?? 0)}
        color={link.color}
      />
    </ChartTooltip>
  );
}

function SankeyGradientLink({
  sourceX,
  sourceY,
  sourceControlX,
  targetX,
  targetY,
  targetControlX,
  linkWidth,
  index,
  payload,
}: SankeyLinkRenderProps) {
  const gradientId = `sankey-link-${index}`;
  const color = payload?.color ?? FINTECH_PALETTE.teal;

  return (
    <Layer key={gradientId}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={0.85} />
          <stop offset="100%" stopColor={color} stopOpacity={0.35} />
        </linearGradient>
      </defs>
      <path
        className="recharts-sankey-link"
        d={`
          M${sourceX},${sourceY}
          C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
        `}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={Math.max(linkWidth, 1)}
      />
    </Layer>
  );
}

function SankeyBrandedNode({ x, y, width, height, payload }: SankeyNodeRenderProps) {
  const fill = payload?.color ?? FINTECH_PALETTE.obsidian;

  return (
    <Layer>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={0.92}
        radius={3}
      />
      <text
        x={x + width + 8}
        y={y + height / 2}
        textAnchor="start"
        dominantBaseline="middle"
        className="fill-recoverpe-black text-[10px] font-medium"
      >
        {payload?.name}
      </text>
    </Layer>
  );
}

export function ArSankeyFlow({ data, isLoading = false }: ArSankeyFlowProps) {
  const chartId = useId();
  const totalFlow = useMemo(
    () => data.links.reduce((sum, link) => sum + link.value, 0),
    [data.links]
  );

  const sankeyData = useMemo(
    () => ({
      nodes: data.nodes.map((node) => ({ name: node.name, color: node.color })),
      links: data.links.map((link) => ({
        source: link.source,
        target: link.target,
        value: link.value,
        color: link.color,
      })),
    }),
    [data]
  );

  return (
    <Card className="h-full min-w-0">
      <CardHeader className="border-b border-recoverpe-grey-light px-5 py-4">
        <p className="type-eyebrow">Money river</p>
        <h2 className="mt-1 text-base font-semibold text-recoverpe-black">
          AR lifecycle flow
        </h2>
        <p className="mt-1 text-xs text-recoverpe-grey-medium">
          How invoiced revenue moves from collection through aging into recovery.
        </p>
      </CardHeader>
      <CardContent className="px-2 pb-4 pt-2 sm:px-4">
        {isLoading ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-recoverpe-grey-medium">
            Loading flow...
          </div>
        ) : totalFlow === 0 ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-recoverpe-grey-medium">
            No receivables flow to visualize yet.
          </div>
        ) : (
          <div className="h-[320px] w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                key={chartId}
                data={sankeyData}
                nodePadding={24}
                nodeWidth={12}
                linkCurvature={0.5}
                margin={{ top: 8, right: 120, bottom: 8, left: 8 }}
                link={SankeyGradientLink}
                node={SankeyBrandedNode}
              >
                <Tooltip content={<SankeyFlowTooltip />} />
              </Sankey>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
