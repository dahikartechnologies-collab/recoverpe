import { describe, expect, it } from "vitest";
import {
  AccountingExportData,
  buildAccountingCsv,
  buildGstr3bSummary,
  buildTallyXml,
  escapeXml,
  toTallyDate,
} from "@/lib/accounting-export";

function sampleData(
  overrides: Partial<AccountingExportData> = {}
): AccountingExportData {
  return {
    businessName: "Sharma Traders",
    businessGstin: "27AAAAA0000A1Z5",
    fromDate: "2026-04-01",
    toDate: "2026-06-30",
    sales: [
      {
        date: "2026-04-15",
        voucherNumber: "INV/26-27/0001",
        partyName: "Gupta Stores",
        partyGstin: "27BBBBB0000B1Z5",
        taxableValue: 10000,
        cgst: 900,
        sgst: 900,
        igst: 0,
        total: 11800,
        narration: null,
      },
    ],
    receipts: [
      {
        date: "2026-04-20",
        voucherNumber: "UTR123456",
        partyName: "Gupta Stores",
        amount: 11800,
        paymentMode: "upi_link",
        reference: "UTR123456",
      },
    ],
    purchases: [
      {
        date: "2026-04-10",
        voucherNumber: "EXP/26-27/0001",
        payeeName: "Verma Supplies",
        supplierGstin: "27CCCCC0000C1Z5",
        hsnSac: "9983",
        taxableValue: 5000,
        cgst: 450,
        sgst: 450,
        igst: 0,
        total: 5900,
        tdsSection: null,
        tdsAmount: 0,
        inputCreditEligible: true,
        category: "raw_material",
        narration: null,
      },
    ],
    ...overrides,
  };
}

describe("toTallyDate", () => {
  it("converts ISO to DDMMYYYY", () => {
    expect(toTallyDate("2026-04-15")).toBe("15042026");
  });
});

describe("escapeXml", () => {
  it("escapes all five XML metacharacters", () => {
    expect(escapeXml(`R&D <"tag"> 'x'`)).toBe(
      "R&amp;D &lt;&quot;tag&quot;&gt; &apos;x&apos;"
    );
  });
});

describe("buildGstr3bSummary", () => {
  it("nets output tax against eligible input credit", () => {
    const summary = buildGstr3bSummary(sampleData());

    expect(summary.outwardTaxableValue).toBe(10000);
    expect(summary.outwardTotalTax).toBe(1800);
    expect(summary.eligibleItcTotal).toBe(900);
    expect(summary.netTaxPayable).toBe(900);
  });

  it("excludes blocked credits from the ITC claim", () => {
    const data = sampleData();
    data.purchases[0].inputCreditEligible = false;

    const summary = buildGstr3bSummary(data);

    expect(summary.eligibleItcTotal).toBe(0);
    expect(summary.inwardTaxableValue).toBe(0);
    expect(summary.netTaxPayable).toBe(1800);
  });

  it("reports a negative net when credit exceeds output tax", () => {
    const data = sampleData();
    data.sales = [];

    expect(buildGstr3bSummary(data).netTaxPayable).toBe(-900);
  });

  it("totals TDS across purchases regardless of ITC eligibility", () => {
    const data = sampleData();
    data.purchases[0].tdsAmount = 500;
    data.purchases[0].inputCreditEligible = false;

    expect(buildGstr3bSummary(data).tdsWithheld).toBe(500);
  });
});

describe("buildTallyXml", () => {
  it("emits the import envelope Tally expects", () => {
    const xml = buildTallyXml(sampleData());

    expect(xml).toContain("<ENVELOPE>");
    expect(xml).toContain("<TALLYREQUEST>Import Data</TALLYREQUEST>");
    expect(xml).toContain("<REPORTNAME>Vouchers</REPORTNAME>");
    expect(xml).toContain(
      "<SVCURRENTCOMPANY>Sharma Traders</SVCURRENTCOMPANY>"
    );
    expect(xml).toContain("</ENVELOPE>");
  });

  it("emits one voucher per book with the right voucher type", () => {
    const xml = buildTallyXml(sampleData());

    expect(xml).toContain("<VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>");
    expect(xml).toContain("<VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>");
    expect(xml).toContain("<VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>");
  });

  it("allocates GST to the correct output and input ledgers", () => {
    const xml = buildTallyXml(sampleData());

    expect(xml).toContain("<LEDGERNAME>Output CGST</LEDGERNAME>");
    expect(xml).toContain("<LEDGERNAME>Input CGST</LEDGERNAME>");
    expect(xml).not.toContain("<LEDGERNAME>Output IGST</LEDGERNAME>");
  });

  it("balances each sales voucher to zero", () => {
    const xml = buildTallyXml(sampleData());
    const amounts = (xml.match(/<AMOUNT>-?[\d.]+<\/AMOUNT>/g) ?? []).map(
      (tag) => Number(tag.replace(/<\/?AMOUNT>/g, ""))
    );

    // Debits are negative and credits positive, so a correct set nets to zero.
    const salesTotal = amounts.slice(0, 4).reduce((sum, n) => sum + n, 0);
    expect(salesTotal).toBeCloseTo(0, 2);
  });

  it("escapes a party name containing an ampersand", () => {
    const data = sampleData();
    data.sales[0].partyName = "Gupta & Sons";

    const xml = buildTallyXml(data);

    expect(xml).toContain("Gupta &amp; Sons");
    expect(xml).not.toContain("Gupta & Sons");
  });
});

describe("buildAccountingCsv", () => {
  it("includes a header and one row per voucher", () => {
    const rows = buildAccountingCsv(sampleData()).split("\r\n");

    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain('"Book"');
    expect(rows[1]).toContain('"Sales"');
    expect(rows[2]).toContain('"Receipt"');
    expect(rows[3]).toContain('"Purchase"');
  });

  it("neutralises a formula-injection payee name", () => {
    const data = sampleData();
    data.purchases[0].payeeName = "=cmd|'/c calc'!A1";

    const csv = buildAccountingCsv(data);

    expect(csv).toContain(`"'=cmd`);
  });

  it("escapes embedded quotes", () => {
    const data = sampleData();
    data.sales[0].partyName = 'Gupta "Bhai" Stores';

    expect(buildAccountingCsv(data)).toContain('"Gupta ""Bhai"" Stores"');
  });
});
