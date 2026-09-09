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
} from "@/components/pdf/pdf-shared";

registerPdfDefaults();

export interface InvoicePDFProps {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  businessName: string;
  businessGstin: string | null;
  businessLogoUrl: string | null;
  contactName: string;
  contactPhone: string;
  clientGstin: string | null;
  gstBreakdown: GstBreakdown;
  qrCodeBase64: string;
  upiUri: string;
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
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  colDescription: { width: "70%" },
  colAmount: { width: "30%", textAlign: "right" },
  th: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: PDF_COLORS.gray700,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.black,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: 700,
  },
  paymentSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
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
  },
});

export function InvoicePDF({
  invoiceNumber,
  invoiceDate,
  dueDate,
  businessName,
  contactName,
  contactPhone,
  clientGstin,
  gstBreakdown,
  qrCodeBase64,
  showRecoverpeBranding = true,
}: InvoicePDFProps) {
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
          <Text style={styles.documentTitle}>Bill of Supply</Text>
        </View>

        <View style={styles.twoColumnGrid}>
          <View style={[styles.gridColumn, styles.gridColumnLeft]}>
            <Text style={styles.gridHeading}>Bill To</Text>
            <Text style={styles.gridLine}>{contactName}</Text>
            <Text style={styles.gridLine}>{contactPhone}</Text>
            {clientGstin ? (
              <Text style={styles.gridLine}>GSTIN: {clientGstin}</Text>
            ) : null}
          </View>
          <View style={styles.gridColumn}>
            <Text style={styles.gridHeading}>Invoice Details</Text>
            <Text style={styles.gridLine}>Invoice No. {invoiceNumber}</Text>
            <Text style={styles.gridLine}>Invoice Date {invoiceDate}</Text>
            <Text style={styles.gridLine}>Due Date {dueDate}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, styles.colDescription]}>Description</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.colDescription}>Amount due</Text>
            <Text style={styles.colAmount}>
              {formatPdfRupee(gstBreakdown.taxableAmount)}
            </Text>
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalLabel}>
            {formatPdfRupee(gstBreakdown.totalAmount)}
          </Text>
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
      </Page>
    </Document>
  );
}
