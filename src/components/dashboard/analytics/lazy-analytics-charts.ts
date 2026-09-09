import dynamic from "next/dynamic";

export const LazyCashFlowChart = dynamic(
  () =>
    import("@/components/dashboard/analytics/CashFlowChart").then(
      (module) => module.CashFlowChart
    ),
  { ssr: false }
);

export const LazyArSankeyFlow = dynamic(
  () =>
    import("@/components/dashboard/analytics/ArSankeyFlow").then(
      (module) => module.ArSankeyFlow
    ),
  { ssr: false }
);

export const LazyDsoCohortHeatmap = dynamic(
  () =>
    import("@/components/dashboard/analytics/DsoCohortHeatmap").then(
      (module) => module.DsoCohortHeatmap
    ),
  { ssr: false }
);
