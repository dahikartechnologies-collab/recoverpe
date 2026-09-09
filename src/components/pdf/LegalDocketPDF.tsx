import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  PDF_COLORS,
  formatPdfRupee,
  registerPdfDefaults,
  safePdfText,
} from "@/components/pdf/pdf-shared";

registerPdfDefaults();

export interface LegalDocketAnnexureEntry {
  file_name: string;
}

export interface LegalDocketPDFProps {
  generatedAt: string;
  businessName: string;
  businessGstin: string | null;
  businessAddress: string | null;
  contactName: string;
  contactPhone: string;
  contactGstin: string | null;
  invoiceNumber: string | null;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  balanceDue: number;
  annexures: LegalDocketAnnexureEntry[];
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 10,
    color: PDF_COLORS.black,
    backgroundColor: PDF_COLORS.white,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 9,
    textAlign: "center",
    color: PDF_COLORS.gray700,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.black,
    paddingBottom: 4,
  },
  partiesGrid: {
    flexDirection: "row",
    gap: 16,
  },
  partyColumn: {
    flex: 1,
    borderWidth: 1,
    borderColor: PDF_COLORS.gray200,
    padding: 12,
  },
  partyHeading: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  partyLine: {
    fontSize: 9,
    marginBottom: 4,
  },
  table: {
    borderWidth: 1,
    borderColor: PDF_COLORS.black,
    marginTop: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: PDF_COLORS.gray100,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.black,
  },
  tableRow: {
    flexDirection: "row",
  },
  th: {
    fontSize: 8.5,
    fontWeight: 700,
    paddingVertical: 8,
    paddingHorizontal: 8,
    textTransform: "uppercase",
  },
  td: {
    fontSize: 9,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  colInvoice: { width: "28%" },
  colDate: { width: "22%" },
  colAmount: { width: "25%" },
  colBalance: { width: "25%" },
  annexureItem: {
    fontSize: 9,
    marginBottom: 6,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 8,
    color: PDF_COLORS.gray500,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.gray200,
    paddingTop: 6,
  },
});

function PartyBlock({
  heading,
  name,
  gstin,
  phone,
  address,
}: {
  heading: string;
  name: string;
  gstin: string | null;
  phone?: string;
  address?: string | null;
}) {
  return (
    <View style={styles.partyColumn}>
      <Text style={styles.partyHeading}>{heading}</Text>
      <Text style={styles.partyLine}>{name}</Text>
      {address ? <Text style={styles.partyLine}>{address}</Text> : null}
      {phone ? <Text style={styles.partyLine}>Phone: {phone}</Text> : null}
      <Text style={styles.partyLine}>
        GSTIN: {safePdfText(gstin, "Not on file")}
      </Text>
    </View>
  );
}

export function LegalDocketPDF(props: LegalDocketPDFProps) {
  const invoiceNumber = safePdfText(props.invoiceNumber, "Not assigned");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Statement of Account & Legal Docket</Text>
        <Text style={styles.subtitle}>Generated on {props.generatedAt}</Text>

        <Text style={styles.sectionTitle}>Parties</Text>
        <View style={styles.partiesGrid}>
          <PartyBlock
            heading="Merchant"
            name={safePdfText(props.businessName, "Not on file")}
            gstin={props.businessGstin}
            address={props.businessAddress}
          />
          <PartyBlock
            heading="Debtor"
            name={safePdfText(props.contactName, "Not on file")}
            gstin={props.contactGstin}
            phone={safePdfText(props.contactPhone, "Not on file")}
          />
        </View>

        <Text style={styles.sectionTitle}>The Ledger</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colInvoice]}>Invoice Number</Text>
            <Text style={[styles.th, styles.colDate]}>Date</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount</Text>
            <Text style={[styles.th, styles.colBalance]}>Balance Due</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.td, styles.colInvoice]}>{invoiceNumber}</Text>
            <Text style={[styles.td, styles.colDate]}>{props.invoiceDate}</Text>
            <Text style={[styles.td, styles.colAmount]}>
              {formatPdfRupee(props.totalAmount)}
            </Text>
            <Text style={[styles.td, styles.colBalance]}>
              {formatPdfRupee(props.balanceDue)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Annexures / Proof of Debt</Text>
        {props.annexures.length === 0 ? (
          <Text style={styles.annexureItem}>
            No supporting documents have been uploaded to the Evidence Vault.
          </Text>
        ) : (
          props.annexures.map((annexure, index) => (
            <Text key={`${annexure.file_name}-${index}`} style={styles.annexureItem}>
              Annexure {index + 1}: {safePdfText(annexure.file_name, "Unnamed file")}
            </Text>
          ))
        )}

        <Text style={styles.footer} fixed>
          Recoverpe Legal Docket | Confidential | Due Date: {props.dueDate}
        </Text>
      </Page>
    </Document>
  );
}
