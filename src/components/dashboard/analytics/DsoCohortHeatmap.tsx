"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { FINTECH_PALETTE } from "@/components/dashboard/analytics/chart-theme";
import { DsoBucketKey, DsoCohortHeatmapData } from "@/lib/analytics-dso";

interface DsoCohortHeatmapProps {
  data: DsoCohortHeatmapData;
  isLoading?: boolean;
}

const BUCKET_SLOWNESS: Record<DsoBucketKey, number> = {
  "0-15": 0,
  "16-30": 0.33,
  "31-45": 0.66,
  "45+": 1,
};

function mixChannel(start: number, end: number, ratio: number): number {
  return Math.round(start + (end - start) * ratio);
}

function getHeatCellColor(bucket: DsoBucketKey, percent: number): string {
  if (percent <= 0) {
    return "#F8FAFC";
  }

  const intensity = Math.min(1, percent / 100);
  const slowness = BUCKET_SLOWNESS[bucket];

  const red = mixChannel(5, 239, slowness);
  const green = mixChannel(150, 68, slowness);
  const blue = mixChannel(105, 68, slowness);
  const alpha = 0.12 + intensity * 0.78;

  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`;
}

function getHeatCellBorder(bucket: DsoBucketKey, percent: number): string {
  if (percent <= 0) {
    return "#E2E8F0";
  }

  const slowness = BUCKET_SLOWNESS[bucket];
  const color =
    slowness < 0.5 ? FINTECH_PALETTE.emerald : slowness < 0.85 ? FINTECH_PALETTE.gold : FINTECH_PALETTE.coral;

  return `${color}55`;
}

export function DsoCohortHeatmap({ data, isLoading = false }: DsoCohortHeatmapProps) {
  const hasData = data.rows.some((row) => row.totalSettled > 0);

  return (
    <Card className="h-full min-w-0">
      <CardHeader className="border-b border-recoverpe-grey-light px-5 py-4">
        <p className="type-eyebrow">DSO cohorts</p>
        <h2 className="mt-1 text-base font-semibold text-recoverpe-black">
          Time-to-pay heatmap
        </h2>
        <p className="mt-1 text-xs text-recoverpe-grey-medium">
          Share of settled invoices by days-to-pay, tracked across recent invoice months.
        </p>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-4">
        {isLoading ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-recoverpe-grey-medium">
            Loading heatmap...
          </div>
        ) : !hasData ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-recoverpe-grey-medium">
            No settled invoices in the last four months.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <div className="min-w-[420px]">
                <div
                  className="grid gap-1.5"
                  style={{
                    gridTemplateColumns: `96px repeat(${data.columns.length}, minmax(0, 1fr))`,
                  }}
                >
                  <div />
                  {data.columns.map((column) => (
                    <div
                      key={column.key}
                      className="px-1 text-center text-[10px] font-medium uppercase tracking-wide text-recoverpe-grey-medium"
                    >
                      {column.label}
                    </div>
                  ))}

                  {data.rows.map((row) => (
                    <div key={row.monthKey} className="contents">
                      <div className="flex items-center pr-2 text-xs font-medium text-recoverpe-black">
                        {row.label}
                      </div>
                      {data.columns.map((column) => {
                        const cell = row.buckets[column.key];
                        const backgroundColor = getHeatCellColor(column.key, cell.percent);
                        const borderColor = getHeatCellBorder(column.key, cell.percent);

                        return (
                          <div
                            key={`${row.monthKey}-${column.key}`}
                            className="flex min-h-[52px] flex-col items-center justify-center rounded-md border px-1 py-2 transition-colors duration-300"
                            style={{ backgroundColor, borderColor }}
                            title={`${row.label} · ${column.label}: ${cell.percent}% (${cell.count} invoices)`}
                          >
                            <span className="text-sm font-semibold tabular-nums text-recoverpe-black">
                              {cell.percent}%
                            </span>
                            <span className="mt-0.5 text-[10px] text-recoverpe-grey-medium">
                              {cell.count} inv.
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-recoverpe-grey-light pt-3 text-[10px] text-recoverpe-grey-medium">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-6 rounded-sm border"
                  style={{
                    backgroundColor: getHeatCellColor("0-15", 80),
                    borderColor: getHeatCellBorder("0-15", 80),
                  }}
                />
                Fast payers
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-6 rounded-sm border"
                  style={{
                    backgroundColor: getHeatCellColor("45+", 80),
                    borderColor: getHeatCellBorder("45+", 80),
                  }}
                />
                Slow payers
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
