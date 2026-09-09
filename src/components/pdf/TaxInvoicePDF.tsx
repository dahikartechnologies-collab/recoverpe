import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { GstBreakdown } from "@/lib/gst";
import {
  PDF_COLORS,
  formatPdfRupee,
  registerPdfDefaults,
  safePdfText,
} from "@/components/pdf/pdf-shared";

registerPdfDefaults();

export interface TaxInvoicePDFProps {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  businessName: string;
  businessGstin: string | null;
  msmeRegNo?: string | null;
  contactName: string;
  contactPhone: string;
  clientGstin: string | null;
  gstBreakdown: GstBreakdown;
  qrCodeBase64: string;
  showRecoverpeBranding?: boolean;
}

const BORDER = PDF_COLORS.gray200;

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 9.5,
    color: PDF_COLORS.black,
    backgroundColor: PDF_COLORS.white,
    fontFamily: "Helvetica",
    lineHeight: 1.45,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: PDF_COLORS.black,
  },
  wordmarkPrimary: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  wordmarkSecondary: {
    marginTop: 3,
    fontSize: 9,
    letterSpacing: 0.6,
    color: PDF_COLORS.gray700,
    textTransform: "uppercase",
  },
  businessWordmark: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 0.8,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    textAlign: "right",
  },
  documentSubtitle: {
    marginTop: 4,
    fontSize: 9,
    color: PDF_COLORS.gray700,
    textAlign: "right",
  },
  sellerBlock: {
    marginBottom: 16,
  },
  sellerName: {
    fontSize: 11,
    fontWeight: 700,
  },
  sellerMeta: {
    marginTop: 2,
    fontSize: 9,
    color: PDF_COLORS.gray700,
  },
  twoColumnGrid: {
    flexDirection: "row",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  gridColumn: {
    flex: 1,
    padding: 12,
  },
  gridColumnLeft: {
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  gridHeading: {
    fontSize: 8.5,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
    color: PDF_COLORS.gray700,
  },
  gridLine: {
    marginBottom: 4,
    fontSize: 9.5,
  },
  gridLabel: {
    color: PDF_COLORS.gray700,
  },
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: PDF_COLORS.gray50,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "flex-start",
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  th: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: PDF_COLORS.gray700,
  },
  td: {
    fontSize: 9.5,
  },
  colDescription: { width: "34%" },
  colHsn: { width: "14%", textAlign: "center" },
  colAmount: { width: "18%", textAlign: "right" },
  colTax: { width: "18%", textAlign: "right" },
  colTotal: { width: "16%", textAlign: "right" },
  totalsBlock: {
    marginLeft: "auto",
    width: "42%",
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 20,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  totalsRowLast: {
    borderBottomWidth: 0,
    backgroundColor: PDF_COLORS.gray50,
  },
  totalsLabel: {
    fontSize: 9,
    color: PDF_COLORS.gray700,
  },
  totalsValue: {
    fontSize: 9.5,
    fontWeight: 700,
  },
  paymentSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 24,
  },
  qrBox: {
    borderWidth: 1,
    borderColor: PDF_COLORS.black,
    padding: 10,
    alignItems: "center",
    width: 148,
  },
  qrImage: {
    width: 96,
    height: 96,
    marginBottom: 8,
  },
  qrCaption: {
    fontSize: 8.5,
    textAlign: "center",
    lineHeight: 1.4,
    color: PDF_COLORS.black,
  },
  msmeFooter: {
    position: "absolute",
    bottom: 36,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 10,
  },
  msmeFooterText: {
    fontSize: 8,
    color: PDF_COLORS.gray700,
    textAlign: "center",
    lineHeight: 1.45,
  },
});

function taxColumnLabel(gstBreakdown: GstBreakdown): string {
  if (gstBreakdown.igst > 0) {
    return "IGST (18%)";
  }

  if (gstBreakdown.cgst > 0 || gstBreakdown.sgst > 0) {
    return "CGST / SGST";
  }

  return "IGST / CGST";
}

function taxColumnAmount(gstBreakdown: GstBreakdown): string {
  if (gstBreakdown.igst > 0) {
    return formatPdfRupee(gstBreakdown.igst);
  }

  const combined = gstBreakdown.cgst + gstBreakdown.sgst;

  if (combined > 0) {
    return formatPdfRupee(combined);
  }

  return formatPdfRupee(0);
}

export function TaxInvoicePDF({
  invoiceNumber,
  invoiceDate,
  dueDate,
  businessName,
  businessGstin,
  contactName,
  contactPhone,
  clientGstin,
  gstBreakdown,
  qrCodeBase64,
  msmeRegNo = null,
  showRecoverpeBranding = true,
}: TaxInvoicePDFProps) {
  const taxLabel = taxColumnLabel(gstBreakdown);
  const taxAmount = taxColumnAmount(gstBreakdown);
  const msmeFooterLabel = safePdfText(msmeRegNo, "Not registered");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {showRecoverpeBranding ? (
              <>
                <Text style={styles.wordmarkPrimary}>RecoverPe</Text>
                <Text style={styles.wordmarkSecondary}>Dahikar Technologies Pvt. Ltd.</Text>
              </>
            ) : (
              <Text style={styles.businessWordmark}>{businessName}</Text>
            )}
          </View>
          <View>
            <Text style={styles.documentTitle}>Tax Invoice</Text>
            <Text style={styles.documentSubtitle}>Original for Recipient</Text>
          </View>
        </View>

        <View style={styles.sellerBlock}>
          <Text style={styles.sellerName}>{businessName}</Text>
          {businessGstin ? (
            <Text style={styles.sellerMeta}>GSTIN: {businessGstin}</Text>
          ) : null}
        </View>

        <View style={styles.twoColumnGrid}>
          <View style={[styles.gridColumn, styles.gridColumnLeft]}>
            <Text style={styles.gridHeading}>Bill To</Text>
            <Text style={styles.gridLine}>{contactName}</Text>
            <Text style={styles.gridLine}>{contactPhone}</Text>
            {clientGstin ? (
              <Text style={styles.gridLine}>GSTIN: {clientGstin}</Text>
            ) : (
              <Text style={[styles.gridLine, styles.gridLabel]}>GSTIN: Not provided</Text>
            )}
          </View>
          <View style={styles.gridColumn}>
            <Text style={styles.gridHeading}>Invoice Details</Text>
            <View style={styles.gridLine}>
              <Text>
                <Text style={styles.gridLabel}>Invoice No. </Text>
                {safePdfText(invoiceNumber, "—")}
              </Text>
            </View>
            <View style={styles.gridLine}>
              <Text>
                <Text style={styles.gridLabel}>Invoice Date </Text>
                {invoiceDate}
              </Text>
            </View>
            <View style={styles.gridLine}>
              <Text>
                <Text style={styles.gridLabel}>Due Date </Text>
                {dueDate}
              </Text>
            </View>
            {businessGstin ? (
              <View style={styles.gridLine}>
                <Text>
                  <Text style={styles.gridLabel}>Supplier GSTIN </Text>
                  {businessGstin}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colDescription]}>Description</Text>
            <Text style={[styles.th, styles.colHsn]}>HSN/SAC</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount</Text>
            <Text style={[styles.th, styles.colTax]}>{taxLabel}</Text>
            <Text style={[styles.th, styles.colTotal]}>Total</Text>
          </View>
          <View style={[styles.tableRow, styles.tableRowLast]}>
            <Text style={[styles.td, styles.colDescription]}>
              Outstanding amount due against supplied goods / services
            </Text>
            <Text style={[styles.td, styles.colHsn]}>998599</Text>
            <Text style={[styles.td, styles.colAmount]}>
              {formatPdfRupee(gstBreakdown.taxableAmount)}
            </Text>
            <Text style={[styles.td, styles.colTax]}>{taxAmount}</Text>
            <Text style={[styles.td, styles.colTotal]}>
              {formatPdfRupee(gstBreakdown.totalAmount)}
            </Text>
          </View>
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Taxable Value</Text>
            <Text style={styles.totalsValue}>
              {formatPdfRupee(gstBreakdown.taxableAmount)}
            </Text>
          </View>
          {gstBreakdown.cgst > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>CGST (9%)</Text>
              <Text style={styles.totalsValue}>{formatPdfRupee(gstBreakdown.cgst)}</Text>
            </View>
          ) : null}
          {gstBreakdown.sgst > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>SGST (9%)</Text>
              <Text style={styles.totalsValue}>{formatPdfRupee(gstBreakdown.sgst)}</Text>
            </View>
          ) : null}
          {gstBreakdown.igst > 0 ? (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>IGST (18%)</Text>
              <Text style={styles.totalsValue}>{formatPdfRupee(gstBreakdown.igst)}</Text>
            </View>
          ) : null}
          <View style={[styles.totalsRow, styles.totalsRowLast]}>
            <Text style={styles.totalsLabel}>Grand Total</Text>
            <Text style={styles.totalsValue}>
              {formatPdfRupee(gstBreakdown.totalAmount)}
            </Text>
          </View>
        </View>

        <View style={styles.paymentSection}>
          <View style={styles.qrBox}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
            <Image src={qrCodeBase64} style={styles.qrImage} />
            <Text style={styles.qrCaption}>
              Scan QR to pay exactly {formatPdfRupee(gstBreakdown.totalAmount)}
            </Text>
          </View>
        </View>

        <View style={styles.msmeFooter} fixed>
          <Text style={styles.msmeFooterText}>
            This is a computer-generated tax invoice. MSME Reg No: {msmeFooterLabel}.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
