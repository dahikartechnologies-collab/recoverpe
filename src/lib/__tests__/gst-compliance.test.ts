import { describe, expect, it } from "vitest";
import {
  calculateExpenseTax,
  isValidGstin,
  isValidGstRate,
  stateCodeFromGstin,
} from "@/lib/gst-compliance";

const MAHARASHTRA_GSTIN = "27AAAAA0000A1Z5";
const KARNATAKA_GSTIN = "29AAAAA0000A1Z5";

describe("isValidGstin", () => {
  it("accepts a well-formed GSTIN", () => {
    expect(isValidGstin(MAHARASHTRA_GSTIN)).toBe(true);
  });

  it("rejects wrong length, missing Z, and empty values", () => {
    expect(isValidGstin("27AAAAA0000A1Z")).toBe(false);
    expect(isValidGstin("27AAAAA0000A1X5")).toBe(false);
    expect(isValidGstin(null)).toBe(false);
    expect(isValidGstin("")).toBe(false);
  });
});

describe("stateCodeFromGstin", () => {
  it("returns the two-digit prefix", () => {
    expect(stateCodeFromGstin(MAHARASHTRA_GSTIN)).toBe("27");
    expect(stateCodeFromGstin(null)).toBeNull();
  });
});

describe("isValidGstRate", () => {
  it("allows only the statutory slabs", () => {
    expect(isValidGstRate(18)).toBe(true);
    expect(isValidGstRate(0.25)).toBe(true);
    expect(isValidGstRate(15)).toBe(false);
  });
});

describe("calculateExpenseTax", () => {
  it("splits intra-state supply into equal CGST and SGST", () => {
    const result = calculateExpenseTax({
      enteredAmount: 11800,
      gstRate: 18,
      isAmountInclusive: true,
      businessGstin: MAHARASHTRA_GSTIN,
      placeOfSupply: "27",
      tdsSection: null,
    });

    expect(result.taxableValue).toBe(10000);
    expect(result.cgstAmount).toBe(900);
    expect(result.sgstAmount).toBe(900);
    expect(result.igstAmount).toBe(0);
    expect(result.isInterState).toBe(false);
    expect(result.grossAmount).toBe(11800);
  });

  it("charges IGST when the place of supply differs from the home state", () => {
    const result = calculateExpenseTax({
      enteredAmount: 11800,
      gstRate: 18,
      isAmountInclusive: true,
      businessGstin: MAHARASHTRA_GSTIN,
      placeOfSupply: "29",
      tdsSection: null,
    });

    expect(result.igstAmount).toBe(1800);
    expect(result.cgstAmount).toBe(0);
    expect(result.sgstAmount).toBe(0);
    expect(result.isInterState).toBe(true);
  });

  it("treats an absent place of supply as intra-state", () => {
    const result = calculateExpenseTax({
      enteredAmount: 1180,
      gstRate: 18,
      isAmountInclusive: true,
      businessGstin: KARNATAKA_GSTIN,
      placeOfSupply: null,
      tdsSection: null,
    });

    expect(result.isInterState).toBe(false);
    expect(result.cgstAmount).toBe(90);
    expect(result.sgstAmount).toBe(90);
  });

  it("adds tax on top when the amount is exclusive", () => {
    const result = calculateExpenseTax({
      enteredAmount: 10000,
      gstRate: 18,
      isAmountInclusive: false,
      businessGstin: MAHARASHTRA_GSTIN,
      placeOfSupply: "27",
      tdsSection: null,
    });

    expect(result.taxableValue).toBe(10000);
    expect(result.grossAmount).toBe(11800);
  });

  it("records no tax for an unregistered business regardless of rate", () => {
    const result = calculateExpenseTax({
      enteredAmount: 11800,
      gstRate: 18,
      isAmountInclusive: true,
      businessGstin: null,
      placeOfSupply: null,
      tdsSection: null,
    });

    expect(result.taxableValue).toBe(11800);
    expect(result.totalGst).toBe(0);
    expect(result.grossAmount).toBe(11800);
  });

  it("withholds TDS on the taxable value, not the gross", () => {
    const result = calculateExpenseTax({
      enteredAmount: 11800,
      gstRate: 18,
      isAmountInclusive: true,
      businessGstin: MAHARASHTRA_GSTIN,
      placeOfSupply: "27",
      tdsSection: "194J",
    });

    expect(result.tdsRate).toBe(10);
    expect(result.tdsAmount).toBe(1000);
    expect(result.netPayable).toBe(10800);
  });

  it("keeps the split reconciled when halving produces an odd paise", () => {
    const result = calculateExpenseTax({
      enteredAmount: 105,
      gstRate: 5,
      isAmountInclusive: true,
      businessGstin: MAHARASHTRA_GSTIN,
      placeOfSupply: "27",
      tdsSection: null,
    });

    expect(result.cgstAmount + result.sgstAmount).toBeCloseTo(
      result.totalGst,
      2
    );
    expect(result.taxableValue + result.totalGst).toBeCloseTo(
      result.grossAmount,
      2
    );
  });

  it("falls back to zero for an unrecognised rate", () => {
    const result = calculateExpenseTax({
      enteredAmount: 1000,
      gstRate: 17,
      isAmountInclusive: true,
      businessGstin: MAHARASHTRA_GSTIN,
      placeOfSupply: "27",
      tdsSection: null,
    });

    expect(result.totalGst).toBe(0);
    expect(result.taxableValue).toBe(1000);
  });
});
