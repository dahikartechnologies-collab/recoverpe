/**
 * GST and TDS arithmetic for the expense ledger.
 *
 * Everything here is server-authoritative. The client submits a rate and a
 * gross or net amount; it never submits the tax split, because a tampered
 * split would flow straight into a GSTR-3B figure the merchant files.
 */

export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28] as const;
export type GstRate = (typeof GST_RATES)[number];

/** Common TDS sections for MSME payables. Rates are the non-company defaults. */
export const TDS_SECTIONS: Record<string, { label: string; rate: number }> = {
  "194C": { label: "194C — Contractor / sub-contractor", rate: 1 },
  "194H": { label: "194H — Commission or brokerage", rate: 5 },
  "194I": { label: "194I — Rent", rate: 10 },
  "194J": { label: "194J — Professional or technical fees", rate: 10 },
  "194Q": { label: "194Q — Purchase of goods", rate: 0.1 },
};

export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

const GSTIN_PATTERN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGstin(value: string | null | undefined): boolean {
  const trimmed = value?.trim().toUpperCase();
  return Boolean(trimmed && GSTIN_PATTERN.test(trimmed));
}

export function stateCodeFromGstin(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length >= 2 ? trimmed.slice(0, 2) : null;
}

export function isValidGstRate(value: number): value is GstRate {
  return (GST_RATES as readonly number[]).includes(value);
}

/** Rounds to paise. Floating point drift here becomes a filing mismatch. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface ExpenseTaxInput {
  /** Amount as entered by the user. */
  enteredAmount: number;
  gstRate: number;
  /** True when enteredAmount already includes GST. */
  isAmountInclusive: boolean;
  /** GSTIN of the business recording the expense, if registered. */
  businessGstin: string | null;
  /** Two-digit state code where the supply was received. */
  placeOfSupply: string | null;
  tdsSection: string | null;
}

export interface ExpenseTaxBreakdown {
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGst: number;
  /** taxableValue + totalGst. This is what lands in expenses.amount. */
  grossAmount: number;
  tdsRate: number;
  tdsAmount: number;
  /** What actually leaves the bank after withholding. */
  netPayable: number;
  isInterState: boolean;
}

/**
 * Derives the full tax breakdown for one expense voucher.
 *
 * An unregistered business cannot claim input credit, so its expenses are
 * recorded at face value with a zero split regardless of the rate submitted.
 */
export function calculateExpenseTax(
  input: ExpenseTaxInput
): ExpenseTaxBreakdown {
  const rate = isValidGstRate(input.gstRate) ? input.gstRate : 0;
  const registered = isValidGstin(input.businessGstin);
  const effectiveRate = registered ? rate : 0;

  const taxableValue = input.isAmountInclusive
    ? round2(input.enteredAmount / (1 + effectiveRate / 100))
    : round2(input.enteredAmount);

  const totalGst = round2((taxableValue * effectiveRate) / 100);

  const businessState = stateCodeFromGstin(input.businessGstin);
  const supplyState = input.placeOfSupply?.trim() || businessState;
  // Absent an explicit place of supply, assume intra-state: it is the common
  // case and understating IGST is the safer default for a merchant to correct.
  const isInterState = Boolean(
    businessState && supplyState && businessState !== supplyState
  );

  const cgstAmount = isInterState ? 0 : round2(totalGst / 2);
  const sgstAmount = isInterState ? 0 : round2(totalGst - cgstAmount);
  const igstAmount = isInterState ? totalGst : 0;

  const grossAmount = round2(taxableValue + cgstAmount + sgstAmount + igstAmount);

  // TDS is withheld on the taxable value, not the GST-inclusive total.
  const tdsRate = input.tdsSection
    ? (TDS_SECTIONS[input.tdsSection]?.rate ?? 0)
    : 0;
  const tdsAmount = round2((taxableValue * tdsRate) / 100);

  return {
    taxableValue,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalGst: round2(cgstAmount + sgstAmount + igstAmount),
    grossAmount,
    tdsRate,
    tdsAmount,
    netPayable: round2(grossAmount - tdsAmount),
    isInterState,
  };
}
