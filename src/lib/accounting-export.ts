/**
 * Accounting export: sales, receipts, and purchase vouchers in formats a CA
 * can actually consume — Tally Prime XML, CSV, or JSON.
 */

export interface SalesVoucher {
  date: string;
  voucherNumber: string;
  partyName: string;
  partyGstin: string | null;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  narration: string | null;
}

export interface ReceiptVoucher {
  date: string;
  voucherNumber: string;
  partyName: string;
  amount: number;
  paymentMode: string;
  reference: string | null;
}

export interface PurchaseVoucher {
  date: string;
  voucherNumber: string;
  payeeName: string;
  supplierGstin: string | null;
  hsnSac: string | null;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  tdsSection: string | null;
  tdsAmount: number;
  inputCreditEligible: boolean;
  category: string;
  narration: string | null;
}

export interface AccountingExportData {
  businessName: string;
  businessGstin: string | null;
  fromDate: string;
  toDate: string;
  sales: SalesVoucher[];
  receipts: ReceiptVoucher[];
  purchases: PurchaseVoucher[];
}

export interface Gstr3bSummary {
  outwardTaxableValue: number;
  outwardCgst: number;
  outwardSgst: number;
  outwardIgst: number;
  outwardTotalTax: number;
  inwardTaxableValue: number;
  eligibleItcCgst: number;
  eligibleItcSgst: number;
  eligibleItcIgst: number;
  eligibleItcTotal: number;
  /** Positive means payable to the department, negative is carried forward. */
  netTaxPayable: number;
  tdsWithheld: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function buildGstr3bSummary(data: AccountingExportData): Gstr3bSummary {
  const outward = data.sales.reduce(
    (acc, row) => ({
      taxable: acc.taxable + row.taxableValue,
      cgst: acc.cgst + row.cgst,
      sgst: acc.sgst + row.sgst,
      igst: acc.igst + row.igst,
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0 }
  );

  // Blocked credits under CGST Act s.17(5) still appear as purchases but must
  // not inflate the ITC claim.
  const inward = data.purchases
    .filter((row) => row.inputCreditEligible)
    .reduce(
      (acc, row) => ({
        taxable: acc.taxable + row.taxableValue,
        cgst: acc.cgst + row.cgst,
        sgst: acc.sgst + row.sgst,
        igst: acc.igst + row.igst,
      }),
      { taxable: 0, cgst: 0, sgst: 0, igst: 0 }
    );

  const outwardTotalTax = outward.cgst + outward.sgst + outward.igst;
  const eligibleItcTotal = inward.cgst + inward.sgst + inward.igst;

  return {
    outwardTaxableValue: round2(outward.taxable),
    outwardCgst: round2(outward.cgst),
    outwardSgst: round2(outward.sgst),
    outwardIgst: round2(outward.igst),
    outwardTotalTax: round2(outwardTotalTax),
    inwardTaxableValue: round2(inward.taxable),
    eligibleItcCgst: round2(inward.cgst),
    eligibleItcSgst: round2(inward.sgst),
    eligibleItcIgst: round2(inward.igst),
    eligibleItcTotal: round2(eligibleItcTotal),
    netTaxPayable: round2(outwardTotalTax - eligibleItcTotal),
    tdsWithheld: round2(
      data.purchases.reduce((sum, row) => sum + row.tdsAmount, 0)
    ),
  };
}

/** Tally rejects a document containing raw XML metacharacters. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Tally expects DDMMYYYY with no separators. */
export function toTallyDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}${month}${year}`;
}

function amountTag(tag: string, value: number): string {
  return `<${tag}>${value.toFixed(2)}</${tag}>`;
}

/**
 * In Tally's ledger model a debit is negative and a credit is positive, which
 * is inverted from how most people read a balance sheet. Sales credit the
 * income ledger and debit the party; purchases do the reverse.
 */
function ledgerEntry(
  ledgerName: string,
  amount: number,
  isDeemedPositive: boolean
): string {
  return [
    "<ALLLEDGERENTRIES.LIST>",
    `<LEDGERNAME>${escapeXml(ledgerName)}</LEDGERNAME>`,
    `<ISDEEMEDPOSITIVE>${isDeemedPositive ? "Yes" : "No"}</ISDEEMEDPOSITIVE>`,
    amountTag("AMOUNT", isDeemedPositive ? -Math.abs(amount) : Math.abs(amount)),
    "</ALLLEDGERENTRIES.LIST>",
  ].join("");
}

function salesVoucherXml(row: SalesVoucher, companyName: string): string {
  const entries = [
    ledgerEntry(row.partyName, row.total, true),
    ledgerEntry("Sales Account", row.taxableValue, false),
    row.cgst > 0 ? ledgerEntry("Output CGST", row.cgst, false) : "",
    row.sgst > 0 ? ledgerEntry("Output SGST", row.sgst, false) : "",
    row.igst > 0 ? ledgerEntry("Output IGST", row.igst, false) : "",
  ].join("");

  return [
    `<TALLYMESSAGE xmlns:UDF="TallyUDF">`,
    `<VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">`,
    `<DATE>${toTallyDate(row.date)}</DATE>`,
    `<EFFECTIVEDATE>${toTallyDate(row.date)}</EFFECTIVEDATE>`,
    `<VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>`,
    `<VOUCHERNUMBER>${escapeXml(row.voucherNumber)}</VOUCHERNUMBER>`,
    `<PARTYLEDGERNAME>${escapeXml(row.partyName)}</PARTYLEDGERNAME>`,
    `<PARTYNAME>${escapeXml(row.partyName)}</PARTYNAME>`,
    row.partyGstin
      ? `<PARTYGSTIN>${escapeXml(row.partyGstin)}</PARTYGSTIN>`
      : "",
    `<PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>`,
    `<COMPANYNAME>${escapeXml(companyName)}</COMPANYNAME>`,
    row.narration ? `<NARRATION>${escapeXml(row.narration)}</NARRATION>` : "",
    entries,
    `</VOUCHER>`,
    `</TALLYMESSAGE>`,
  ].join("");
}

function receiptVoucherXml(row: ReceiptVoucher, companyName: string): string {
  const bankLedger =
    row.paymentMode === "cash_manual" ? "Cash" : "Bank Account";

  return [
    `<TALLYMESSAGE xmlns:UDF="TallyUDF">`,
    `<VOUCHER VCHTYPE="Receipt" ACTION="Create">`,
    `<DATE>${toTallyDate(row.date)}</DATE>`,
    `<VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>`,
    `<VOUCHERNUMBER>${escapeXml(row.voucherNumber)}</VOUCHERNUMBER>`,
    `<PARTYLEDGERNAME>${escapeXml(row.partyName)}</PARTYLEDGERNAME>`,
    `<COMPANYNAME>${escapeXml(companyName)}</COMPANYNAME>`,
    row.reference ? `<REFERENCE>${escapeXml(row.reference)}</REFERENCE>` : "",
    ledgerEntry(bankLedger, row.amount, true),
    ledgerEntry(row.partyName, row.amount, false),
    `</VOUCHER>`,
    `</TALLYMESSAGE>`,
  ].join("");
}

function purchaseVoucherXml(row: PurchaseVoucher, companyName: string): string {
  const entries = [
    ledgerEntry(row.category, row.taxableValue, true),
    row.cgst > 0 ? ledgerEntry("Input CGST", row.cgst, true) : "",
    row.sgst > 0 ? ledgerEntry("Input SGST", row.sgst, true) : "",
    row.igst > 0 ? ledgerEntry("Input IGST", row.igst, true) : "",
    row.tdsAmount > 0
      ? ledgerEntry(`TDS Payable ${row.tdsSection ?? ""}`.trim(), row.tdsAmount, false)
      : "",
    ledgerEntry(row.payeeName, row.total - row.tdsAmount, false),
  ].join("");

  return [
    `<TALLYMESSAGE xmlns:UDF="TallyUDF">`,
    `<VOUCHER VCHTYPE="Purchase" ACTION="Create" OBJVIEW="Invoice Voucher View">`,
    `<DATE>${toTallyDate(row.date)}</DATE>`,
    `<VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>`,
    `<VOUCHERNUMBER>${escapeXml(row.voucherNumber)}</VOUCHERNUMBER>`,
    `<PARTYLEDGERNAME>${escapeXml(row.payeeName)}</PARTYLEDGERNAME>`,
    `<PARTYNAME>${escapeXml(row.payeeName)}</PARTYNAME>`,
    row.supplierGstin
      ? `<PARTYGSTIN>${escapeXml(row.supplierGstin)}</PARTYGSTIN>`
      : "",
    row.hsnSac ? `<HSNCODE>${escapeXml(row.hsnSac)}</HSNCODE>` : "",
    `<COMPANYNAME>${escapeXml(companyName)}</COMPANYNAME>`,
    row.narration ? `<NARRATION>${escapeXml(row.narration)}</NARRATION>` : "",
    entries,
    `</VOUCHER>`,
    `</TALLYMESSAGE>`,
  ].join("");
}

export function buildTallyXml(data: AccountingExportData): string {
  const company = data.businessName;

  const messages = [
    ...data.sales.map((row) => salesVoucherXml(row, company)),
    ...data.receipts.map((row) => receiptVoucherXml(row, company)),
    ...data.purchases.map((row) => purchaseVoucherXml(row, company)),
  ].join("");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<ENVELOPE>`,
    `<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>`,
    `<BODY>`,
    `<IMPORTDATA>`,
    `<REQUESTDESC>`,
    `<REPORTNAME>Vouchers</REPORTNAME>`,
    `<STATICVARIABLES>`,
    `<SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>`,
    `</STATICVARIABLES>`,
    `</REQUESTDESC>`,
    `<REQUESTDATA>`,
    messages,
    `</REQUESTDATA>`,
    `</IMPORTDATA>`,
    `</BODY>`,
    `</ENVELOPE>`,
  ].join("");
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  // A leading =, +, -, or @ is executed as a formula by Excel, so a payee name
  // is a script injection vector unless it is neutralised.
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;

  return `"${guarded.replace(/"/g, '""')}"`;
}

export function buildAccountingCsv(data: AccountingExportData): string {
  const rows: string[] = [];

  rows.push(
    [
      "Book",
      "Date",
      "Voucher No",
      "Party",
      "GSTIN",
      "HSN/SAC",
      "Taxable Value",
      "CGST",
      "SGST",
      "IGST",
      "Total",
      "TDS Section",
      "TDS Amount",
      "ITC Eligible",
      "Narration",
    ]
      .map(csvCell)
      .join(",")
  );

  for (const row of data.sales) {
    rows.push(
      [
        "Sales",
        row.date,
        row.voucherNumber,
        row.partyName,
        row.partyGstin,
        "",
        row.taxableValue.toFixed(2),
        row.cgst.toFixed(2),
        row.sgst.toFixed(2),
        row.igst.toFixed(2),
        row.total.toFixed(2),
        "",
        "0.00",
        "",
        row.narration,
      ]
        .map(csvCell)
        .join(",")
    );
  }

  for (const row of data.receipts) {
    rows.push(
      [
        "Receipt",
        row.date,
        row.voucherNumber,
        row.partyName,
        "",
        "",
        row.amount.toFixed(2),
        "0.00",
        "0.00",
        "0.00",
        row.amount.toFixed(2),
        "",
        "0.00",
        "",
        row.reference,
      ]
        .map(csvCell)
        .join(",")
    );
  }

  for (const row of data.purchases) {
    rows.push(
      [
        "Purchase",
        row.date,
        row.voucherNumber,
        row.payeeName,
        row.supplierGstin,
        row.hsnSac,
        row.taxableValue.toFixed(2),
        row.cgst.toFixed(2),
        row.sgst.toFixed(2),
        row.igst.toFixed(2),
        row.total.toFixed(2),
        row.tdsSection,
        row.tdsAmount.toFixed(2),
        row.inputCreditEligible ? "Yes" : "No",
        row.narration,
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return rows.join("\r\n");
}
