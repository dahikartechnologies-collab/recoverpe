export type PipelineFilterId =
  | "all"
  | "draft"
  | "awaiting_otp"
  | "kyc_review"
  | "active"
  | "cash_held"
  | "dropped";

export interface PipelineFilterOption {
  id: PipelineFilterId;
  label: string;
}

export const PIPELINE_FILTERS: PipelineFilterOption[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft" },
  { id: "awaiting_otp", label: "Awaiting OTP" },
  { id: "kyc_review", label: "KYC Review" },
  { id: "active", label: "Active" },
  { id: "cash_held", label: "Cash Held" },
  { id: "dropped", label: "Dropped" },
];

export function matchesPipelineFilter(
  status: string,
  filter: PipelineFilterId
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "draft":
      return status === "draft";
    case "awaiting_otp":
      return status === "awaiting_merchant_otp";
    case "kyc_review":
      return status === "cash_held";
    case "active":
      return status === "activated";
    case "cash_held":
      return status === "cash_held";
    case "dropped":
      return status === "cancelled" || status === "clawback";
    default:
      return true;
  }
}
