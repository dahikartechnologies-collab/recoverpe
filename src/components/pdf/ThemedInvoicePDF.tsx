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
  InvoiceLayoutTheme,
  InvoiceLineItem,
  lineItemAmount,
} from "@/lib/invoice-line-items";
import { invoiceThemeTokens } from "@/lib/invoice-themes";
import {
  formatPdfRupee,
  registerPdfDefaults,
  safePdfText,
} from "@/components/pdf/pdf-shared";

registerPdfDefaults();

export interface ThemedInvoicePDFProps {
  theme: InvoiceLayoutTheme;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  businessName: string;
  businessGstin: string | null;
  contactName: string;
  contactPhone: string;
  clientGstin: string | null;
  lineItems: InvoiceLineItem[];
  gstBreakdown: GstBreakdown;
  qrCodeBase64?: string | null;
}

export function ThemedInvoicePDF({
  theme,
  invoiceNumber,
  invoiceDate,
  dueDate,
  businessName,
  businessGstin,
  contactName,
  contactPhone,
  clientGstin,
  lineItems,
  gstBreakdown,
  qrCodeBase64,
}: ThemedInvoicePDFProps) {
  const tokens = invoiceThemeTokens(theme);
  const styles = StyleSheet.create({
    page: {
      paddingTop: 0,
      paddingBottom: 56,
      paddingHorizontal: 0,
      fontSize: 9.5,
      color: tokens.text,
      backgroundColor: tokens.pageBg,
      fontFamily: "Helvetica",
      lineHeight: 1.4,
    },
    header: {
      backgroundColor: tokens.headerBg,
      paddingTop: 28,
      paddingBottom: 22,
      paddingHorizontal: 40,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    headerTitle: {
      color: tokens.headerFg,
      fontSize: 20,
      fontWeight: 700,
      letterSpacing: 0.6,
    },
    headerMeta: {
      marginTop: 4,
      color: tokens.headerFg,
      fontSize: 9,
      opacity: 0.85,
    },
    docLabel: {
      color: tokens.headerFg,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      textAlign: "right",
    },
    accentBar: {
      height: 6,
      backgroundColor: tokens.accent,
    },
    body: {
      paddingHorizontal: 40,
      paddingTop: 22,
    },
    grid: {
      flexDirection: "row",
      marginBottom: 18,
      borderWidth: tokens.tableBorderWidth,
      borderColor: tokens.border === "transparent" ? tokens.rowAlt : tokens.border,
    },
    gridCol: {
      flex: 1,
      padding: 12,
    },
    gridHeading: {
      fontSize: 8,
      fontWeight: 700,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: 6,
      color: tokens.muted,
    },
    line: {
      marginBottom: 3,
      fontSize: 9.5,
    },
    table: {
      borderWidth: tokens.tableBorderWidth,
      borderColor: tokens.border === "transparent" ? tokens.rowAlt : tokens.border,
      marginBottom: 14,
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: tokens.tableHeaderBg,
      paddingVertical: 8,
      paddingHorizontal: 8,
    },
    tableRow: {
      flexDirection: "row",
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderBottomWidth: tokens.tableBorderWidth > 0 ? 0.6 : 0,
      borderBottomColor: tokens.border === "transparent" ? tokens.rowAlt : tokens.border,
    },
    th: {
      fontSize: 8,
      fontWeight: 700,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: theme === "corporate" ? "#FFFFFF" : tokens.muted,
    },
    td: {
      fontSize: 9.5,
      color: tokens.text,
    },
    colDesc: { width: "46%" },
    colQty: { width: "12%", textAlign: "right" },
    colRate: { width: "21%", textAlign: "right" },
    colAmt: { width: "21%", textAlign: "right" },
    totals: {
      marginLeft: "auto",
      width: "46%",
      borderWidth: tokens.tableBorderWidth,
      borderColor: tokens.border === "transparent" ? tokens.rowAlt : tokens.border,
    },
    totalsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    totalsGrand: {
      backgroundColor: theme === "corporate" ? tokens.headerBg : tokens.tableHeaderBg,
    },
    totalsGrandText: {
      fontSize: 10,
      fontWeight: 700,
      color: theme === "corporate" ? "#FFFFFF" : tokens.text,
    },
    qrBox: {
      marginTop: 20,
      marginLeft: "auto",
      borderWidth: 1,
      borderColor: tokens.accent,
      padding: 10,
      width: 140,
      alignItems: "center",
    },
    qrImage: { width: 96, height: 96, marginBottom: 6 },
    qrCaption: { fontSize: 8, textAlign: "center", color: tokens.muted },
    footer: {
      position: "absolute",
      bottom: 28,
      left: 40,
      right: 40,
      borderTopWidth: 1,
      borderTopColor: tokens.accent,
      paddingTop: 8,
    },
    footerText: {
      fontSize: 8,
      color: tokens.muted,
      textAlign: "center",
    },
  });

  const documentTitle =
    gstBreakdown.documentType === "tax_invoice" ? "Tax Invoice" : "Bill of Supply";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{businessName}</Text>
            {businessGstin ? (
              <Text style={styles.headerMeta}>GSTIN {businessGstin}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.docLabel}>{documentTitle}</Text>
            <Text style={styles.headerMeta}>{safePdfText(invoiceNumber, "—")}</Text>
          </View>
        </View>
        <View style={styles.accentBar} />

        <View style={styles.body}>
          <View style={styles.grid}>
            <View style={styles.gridCol}>
              <Text style={styles.gridHeading}>Bill To</Text>
              <Text style={styles.line}>{contactName}</Text>
              <Text style={styles.line}>{contactPhone}</Text>
              {clientGstin ? (
                <Text style={styles.line}>GSTIN {clientGstin}</Text>
              ) : null}
            </View>
            <View style={styles.gridCol}>
              <Text style={styles.gridHeading}>Invoice Details</Text>
              <Text style={styles.line}>Date {invoiceDate}</Text>
              <Text style={styles.line}>Due {dueDate}</Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colDesc]}>Description</Text>
              <Text style={[styles.th, styles.colQty]}>Qty</Text>
              <Text style={[styles.th, styles.colRate]}>Rate</Text>
              <Text style={[styles.th, styles.colAmt]}>Amount</Text>
            </View>
            {lineItems.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.tableRow,
                  index % 2 === 1 ? { backgroundColor: tokens.rowAlt } : {},
                ]}
              >
                <Text style={[styles.td, styles.colDesc]}>
                  {safePdfText(item.description, "Item")}
                </Text>
                <Text style={[styles.td, styles.colQty]}>{item.quantity}</Text>
                <Text style={[styles.td, styles.colRate]}>
                  {formatPdfRupee(item.unitPrice)}
                </Text>
                <Text style={[styles.td, styles.colAmt]}>
                  {formatPdfRupee(lineItemAmount(item))}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.totals}>
            <View style={styles.totalsRow}>
              <Text>Taxable value</Text>
              <Text>{formatPdfRupee(gstBreakdown.taxableAmount)}</Text>
            </View>
            {gstBreakdown.cgst > 0 ? (
              <View style={styles.totalsRow}>
                <Text>CGST</Text>
                <Text>{formatPdfRupee(gstBreakdown.cgst)}</Text>
              </View>
            ) : null}
            {gstBreakdown.sgst > 0 ? (
              <View style={styles.totalsRow}>
                <Text>SGST</Text>
                <Text>{formatPdfRupee(gstBreakdown.sgst)}</Text>
              </View>
            ) : null}
            {gstBreakdown.igst > 0 ? (
              <View style={styles.totalsRow}>
                <Text>IGST</Text>
                <Text>{formatPdfRupee(gstBreakdown.igst)}</Text>
              </View>
            ) : null}
            <View style={[styles.totalsRow, styles.totalsGrand]}>
              <Text style={styles.totalsGrandText}>Grand total</Text>
              <Text style={styles.totalsGrandText}>
                {formatPdfRupee(gstBreakdown.totalAmount)}
              </Text>
            </View>
          </View>

          {qrCodeBase64 ? (
            <View style={styles.qrBox}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
              <Image src={qrCodeBase64} style={styles.qrImage} />
              <Text style={styles.qrCaption}>
                Scan to pay {formatPdfRupee(gstBreakdown.totalAmount)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            This is a computer-generated invoice. Theme: {theme}.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
