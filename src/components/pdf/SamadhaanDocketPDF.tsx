import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  PDF_COLORS,
  formatPdfChannel,
  formatPdfDeliveryStatus,
  formatPdfRupee,
  formatPdfTimestampIst,
  registerPdfDefaults,
  safePdfText,
} from "@/components/pdf/pdf-shared";

registerPdfDefaults();

export interface CommunicationLogEntry {
  executed_at: string;
  type: string;
  status: string;
  sentiment?: string | null;
  executive_summary?: string | null;
}

export interface SamadhaanDocketPDFProps {
  generatedAt: string;
  businessName: string;
  businessGstin: string | null;
  businessAddress: string | null;
  contactName: string;
  contactPhone: string;
  contactGstin: string | null;
  contactAddress: string | null;
  invoiceNumber: string | null;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  balanceDue: number;
  ledgerId: string;
  communicationLogs: CommunicationLogEntry[];
  evidenceAnnexures: EvidenceAnnexureEntry[];
}

export interface EvidenceAnnexureEntry {
  file_name: string;
  file_type: string;
  uploaded_at: string;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 44,
    fontSize: 9,
    color: PDF_COLORS.black,
    backgroundColor: PDF_COLORS.white,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },
  dossierHeader: {
    borderBottomWidth: 2,
    borderBottomColor: PDF_COLORS.black,
    paddingBottom: 12,
    marginBottom: 14,
  },
  dossierTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  dossierSubtitle: {
    fontSize: 8.5,
    color: PDF_COLORS.gray700,
    lineHeight: 1.45,
  },
  generatedMeta: {
    marginTop: 6,
    fontSize: 8,
    color: PDF_COLORS.gray500,
  },
  partTitle: {
    fontSize: 9.5,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.gray200,
    textTransform: "uppercase",
  },
  fieldRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  fieldLabel: {
    width: "34%",
    color: PDF_COLORS.gray700,
    fontSize: 8.5,
  },
  fieldValue: {
    width: "66%",
    fontWeight: 700,
    fontSize: 8.5,
  },
  logTable: {
    borderWidth: 1,
    borderColor: PDF_COLORS.gray200,
    marginTop: 6,
  },
  logHeaderRow: {
    flexDirection: "row",
    backgroundColor: PDF_COLORS.gray100,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.gray200,
  },
  logRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.gray200,
  },
  logRowAlt: {
    backgroundColor: PDF_COLORS.gray50,
  },
  th: {
    fontSize: 7.5,
    fontWeight: 700,
    paddingVertical: 5,
    paddingHorizontal: 4,
    color: PDF_COLORS.gray700,
    textTransform: "uppercase",
  },
  td: {
    fontSize: 7.5,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  colSno: { width: "6%" },
  colDatetime: { width: "20%" },
  colChannel: { width: "14%" },
  colStatus: { width: "14%" },
  colEvidence: { width: "46%" },
  emptyLog: {
    padding: 10,
    fontSize: 8.5,
    color: PDF_COLORS.gray700,
    fontStyle: "italic",
  },
  annexureList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: PDF_COLORS.gray200,
  },
  annexureRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.gray200,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  annexureColSno: { width: "8%" },
  annexureColName: { width: "52%" },
  annexureColType: { width: "18%" },
  annexureColDate: { width: "22%" },
  annexureHeaderText: {
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  annexureCellText: {
    fontSize: 8.5,
  },
  declarationBox: {
    borderWidth: 1,
    borderColor: PDF_COLORS.gray200,
    padding: 12,
    marginTop: 14,
  },
  declarationTitle: {
    fontSize: 9.5,
    fontWeight: 700,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  declarationText: {
    fontSize: 8.5,
    textAlign: "justify",
    lineHeight: 1.55,
    marginBottom: 16,
  },
  signatoryBlock: {
    marginTop: 8,
  },
  signatoryLine: {
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.black,
    width: 200,
    marginTop: 24,
    paddingTop: 6,
  },
  signatoryName: {
    fontWeight: 700,
    fontSize: 9,
  },
  signatoryRole: {
    fontSize: 8,
    color: PDF_COLORS.gray700,
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    fontSize: 7.5,
    color: PDF_COLORS.gray500,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.gray200,
    paddingTop: 5,
  },
});

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow} wrap={false}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function logEvidenceSummary(entry: CommunicationLogEntry): string {
  if (entry.executive_summary?.trim()) {
    return entry.executive_summary.trim();
  }

  if (entry.sentiment?.trim()) {
    return `Sentiment: ${entry.sentiment.trim()}`;
  }

  return "Communication logged on Recoverpe platform";
}

function formatDisplayDateForPdf(value: string): string {
  const datePart = value.slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }

  return formatPdfTimestampIst(value);
}

export function SamadhaanDocketPDF(props: SamadhaanDocketPDFProps) {
  const businessName = safePdfText(props.businessName, "Not on file");
  const businessGstin = safePdfText(props.businessGstin, "Not on file");
  const businessAddress = safePdfText(props.businessAddress, "Not on file");
  const contactName = safePdfText(props.contactName, "Not on file");
  const contactPhone = safePdfText(props.contactPhone, "Not on file");
  const contactGstin = safePdfText(props.contactGstin, "Not on file");
  const contactAddress = safePdfText(props.contactAddress, "Not on file");
  const invoiceNumber = safePdfText(props.invoiceNumber, "Not assigned");

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.dossierHeader}>
          <Text style={styles.dossierTitle}>
            ANNEXURE - EVIDENCE DOCKET & CHRONOLOGY OF DEMANDS
          </Text>
          <Text style={styles.dossierSubtitle}>
            Compiled for Submission before the Micro & Small Enterprise Facilitation
            Council (MSEFC) under Section 18 of the MSMED Act, 2006
          </Text>
          <Text style={styles.generatedMeta}>
            Generated: {props.generatedAt} | Reference: {props.ledgerId.slice(0, 8)}
          </Text>
        </View>

        <Text style={styles.partTitle}>Part I: Supplier (Claimant) Profile</Text>
        <ProfileField label="Business Name" value={businessName} />
        <ProfileField label="GSTIN" value={businessGstin} />
        <ProfileField label="Registered Address" value={businessAddress} />

        <Text style={styles.partTitle}>Part II: Buyer (Opposite Party) Profile</Text>
        <ProfileField label="Name" value={contactName} />
        <ProfileField label="Mobile" value={contactPhone} />
        <ProfileField label="Address on Record" value={contactAddress} />
        <ProfileField label="GSTIN" value={contactGstin} />

        <Text style={styles.partTitle}>Part III: Transaction Details</Text>
        <ProfileField label="Invoice No." value={invoiceNumber} />
        <ProfileField label="Invoice Date" value={props.invoiceDate} />
        <ProfileField label="Stated Due Date" value={props.dueDate} />
        <ProfileField
          label="Principal Outstanding"
          value={formatPdfRupee(props.balanceDue)}
        />
        <ProfileField
          label="Original Invoice Value"
          value={formatPdfRupee(props.totalAmount)}
        />

        <Text style={styles.partTitle}>
          Part IV: Chronological Communication Log ({props.communicationLogs.length}{" "}
          records)
        </Text>

        <View style={styles.logTable}>
          <View style={styles.logHeaderRow} wrap={false}>
            <Text style={[styles.th, styles.colSno]}>S.No.</Text>
            <Text style={[styles.th, styles.colDatetime]}>Date & Time (IST)</Text>
            <Text style={[styles.th, styles.colChannel]}>Channel</Text>
            <Text style={[styles.th, styles.colStatus]}>Delivery Status</Text>
            <Text style={[styles.th, styles.colEvidence]}>Evidence / Summary</Text>
          </View>

          {props.communicationLogs.length === 0 ? (
            <Text style={styles.emptyLog}>
              No automated communication records are presently logged for this ledger.
              Manual follow-up records may be annexed separately.
            </Text>
          ) : (
            props.communicationLogs.map((entry, index) => (
              <View
                key={`${entry.executed_at}-${index}`}
                style={
                  index % 2 === 1
                    ? [styles.logRow, styles.logRowAlt]
                    : styles.logRow
                }
                wrap={false}
              >
                <Text style={[styles.td, styles.colSno]}>{String(index + 1)}</Text>
                <Text style={[styles.td, styles.colDatetime]}>
                  {formatPdfTimestampIst(entry.executed_at)}
                </Text>
                <Text style={[styles.td, styles.colChannel]}>
                  {formatPdfChannel(entry.type)}
                </Text>
                <Text style={[styles.td, styles.colStatus]}>
                  {formatPdfDeliveryStatus(entry.status)}
                </Text>
                <Text style={[styles.td, styles.colEvidence]}>
                  {logEvidenceSummary(entry)}
                </Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.partTitle}>
          Part V: Evidence Vault Annexures ({props.evidenceAnnexures.length}{" "}
          files)
        </Text>

        {props.evidenceAnnexures.length === 0 ? (
          <Text style={styles.emptyLog}>
            No supporting documents have been uploaded to the Evidence Vault for
            this ledger.
          </Text>
        ) : (
          <View style={styles.annexureList}>
            <View style={styles.annexureRow} wrap={false}>
              <Text style={[styles.annexureHeaderText, styles.annexureColSno]}>
                S.No.
              </Text>
              <Text style={[styles.annexureHeaderText, styles.annexureColName]}>
                File Name
              </Text>
              <Text style={[styles.annexureHeaderText, styles.annexureColType]}>
                Type
              </Text>
              <Text style={[styles.annexureHeaderText, styles.annexureColDate]}>
                Uploaded
              </Text>
            </View>
            {props.evidenceAnnexures.map((entry, index) => (
              <View key={`${entry.file_name}-${index}`} style={styles.annexureRow} wrap={false}>
                <Text style={[styles.annexureCellText, styles.annexureColSno]}>
                  {String(index + 1)}
                </Text>
                <Text style={[styles.annexureCellText, styles.annexureColName]}>
                  {safePdfText(entry.file_name, "Unnamed file")}
                </Text>
                <Text style={[styles.annexureCellText, styles.annexureColType]}>
                  {safePdfText(entry.file_type, "Other")}
                </Text>
                <Text style={[styles.annexureCellText, styles.annexureColDate]}>
                  {formatDisplayDateForPdf(entry.uploaded_at)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.declarationBox} wrap={false}>
          <Text style={styles.declarationTitle}>
            Part VI: Statutory Verification Statement
          </Text>
          <Text style={styles.declarationText}>
            I hereby declare that the invoices, outstanding balances, and communication
            records compiled herein represent genuine commercial transactions between the
            supplier (claimant) and the buyer (opposite party) named above. The chronology
            of demands reflects bonafide recovery efforts undertaken through the
            Recoverpe platform. The principal outstanding amount stated is true and
            correct to the best of my knowledge and belief, and this docket is submitted
            in support of proceedings before the Micro &amp; Small Enterprise Facilitation
            Council under Section 18 of the MSMED Act, 2006.
          </Text>
          <View style={styles.signatoryBlock}>
            <Text style={{ fontSize: 8.5, marginBottom: 4 }}>Authorized Signatory:</Text>
            <View style={styles.signatoryLine}>
              <Text style={styles.signatoryName}>{businessName}</Text>
              <Text style={styles.signatoryRole}>Claimant / Authorized Representative</Text>
              <Text style={styles.signatoryRole}>Date: {props.generatedAt}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          Recoverpe MSME Samadhaan Smart-Kit | samadhaan.msme.gov.in | Confidential
          Evidence Docket
        </Text>
      </Page>
    </Document>
  );
}
