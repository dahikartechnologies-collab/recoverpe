import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { GstBreakdown, formatCurrency } from "@/lib/gst";

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
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: "#0A0A0A",
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: "#4B5563",
  },
  logo: {
    width: 56,
    height: 56,
    objectFit: "contain",
  },
  section: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 12,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  colDescription: { width: "55%" },
  colAmount: { width: "45%", textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#0A0A0A",
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 700,
  },
  totalValue: {
    fontSize: 12,
    fontWeight: 700,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  qrBlock: {
    alignItems: "flex-end",
  },
  qrImage: {
    width: 96,
    height: 96,
    marginBottom: 4,
  },
  qrCaption: {
    fontSize: 8,
    color: "#4B5563",
    textAlign: "right",
  },
});

export function InvoicePDF({
  invoiceNumber,
  invoiceDate,
  dueDate,
  businessName,
  businessGstin,
  businessLogoUrl,
  contactName,
  contactPhone,
  clientGstin,
  gstBreakdown,
  qrCodeBase64,
}: InvoicePDFProps) {
  const documentTitle =
    gstBreakdown.documentType === "tax_invoice"
      ? "Tax Invoice"
      : "Bill of Supply";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>{documentTitle}</Text>
            <Text style={styles.subtitle}>{businessName}</Text>
            {businessGstin ? (
              <Text style={styles.subtitle}>GSTIN: {businessGstin}</Text>
            ) : null}
          </View>
          {businessLogoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
            <Image src={businessLogoUrl} style={styles.logo} />
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <Text>Invoice No.</Text>
            <Text>{invoiceNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text>Invoice Date</Text>
            <Text>{invoiceDate}</Text>
          </View>
          <View style={styles.row}>
            <Text>Due Date</Text>
            <Text>{dueDate}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={{ fontWeight: 700, marginBottom: 6 }}>Bill To</Text>
          <Text>{contactName}</Text>
          <Text style={styles.subtitle}>{contactPhone}</Text>
          {clientGstin ? (
            <Text style={styles.subtitle}>GSTIN: {clientGstin}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDescription}>Description</Text>
            <Text style={styles.colAmount}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.colDescription}>Amount due</Text>
            <Text style={styles.colAmount}>
              {formatCurrency(gstBreakdown.taxableAmount)}
            </Text>
          </View>

          {gstBreakdown.documentType === "tax_invoice" ? (
            <>
              {gstBreakdown.cgst > 0 ? (
                <View style={styles.tableRow}>
                  <Text style={styles.colDescription}>CGST (9%)</Text>
                  <Text style={styles.colAmount}>
                    {formatCurrency(gstBreakdown.cgst)}
                  </Text>
                </View>
              ) : null}
              {gstBreakdown.sgst > 0 ? (
                <View style={styles.tableRow}>
                  <Text style={styles.colDescription}>SGST (9%)</Text>
                  <Text style={styles.colAmount}>
                    {formatCurrency(gstBreakdown.sgst)}
                  </Text>
                </View>
              ) : null}
              {gstBreakdown.igst > 0 ? (
                <View style={styles.tableRow}>
                  <Text style={styles.colDescription}>IGST (18%)</Text>
                  <Text style={styles.colAmount}>
                    {formatCurrency(gstBreakdown.igst)}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(gstBreakdown.totalAmount)}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.subtitle}>Generated by Recoverpe</Text>
            <Text style={styles.subtitle}>Scan QR to pay via UPI</Text>
          </View>
          <View style={styles.qrBlock}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
            <Image src={qrCodeBase64} style={styles.qrImage} />
            <Text style={styles.qrCaption}>UPI QR Code</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
