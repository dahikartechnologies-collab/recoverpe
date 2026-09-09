import {
  Document,
  Image,
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

export interface LegalNoticePDFProps {
  noticeDate: string;
  settlementDeadline: string;
  claimantName: string;
  claimantGstin: string | null;
  claimantAddress: string | null;
  debtorName: string;
  debtorPhone: string;
  debtorGstin: string | null;
  debtorAddress: string | null;
  invoiceNumber: string | null;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  balanceDue: number;
  daysOverdue: number;
  signatureImageSrc?: string | null;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    fontSize: 10,
    color: PDF_COLORS.black,
    backgroundColor: PDF_COLORS.white,
    fontFamily: "Helvetica",
    lineHeight: 1.62,
  },
  letterhead: {
    alignItems: "center",
    marginBottom: 8,
  },
  advocateName: {
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
  },
  advocateLine: {
    marginTop: 4,
    fontSize: 9.5,
    color: PDF_COLORS.gray700,
    textAlign: "center",
  },
  rule: {
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.black,
    marginVertical: 6,
  },
  thinRule: {
    borderBottomWidth: 0.75,
    borderBottomColor: PDF_COLORS.gray200,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    fontSize: 9.5,
  },
  metaLabel: {
    fontWeight: 700,
  },
  noticeBanner: {
    borderWidth: 1,
    borderColor: PDF_COLORS.black,
    backgroundColor: PDF_COLORS.gray100,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  noticeBannerText: {
    fontSize: 11,
    fontWeight: 700,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  addresseeLabel: {
    fontWeight: 700,
    marginBottom: 4,
  },
  subjectBox: {
    borderWidth: 1,
    borderColor: PDF_COLORS.gray200,
    padding: 10,
    marginBottom: 12,
  },
  subjectLabel: {
    fontWeight: 700,
    marginBottom: 4,
  },
  clause: {
    marginBottom: 9,
    textAlign: "justify",
  },
  clauseNum: {
    fontWeight: 700,
  },
  table: {
    borderWidth: 1,
    borderColor: PDF_COLORS.gray200,
    marginTop: 6,
    marginBottom: 12,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: PDF_COLORS.gray100,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.gray200,
  },
  tableDataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.gray200,
  },
  th: {
    fontSize: 8,
    fontWeight: 700,
    paddingVertical: 6,
    paddingHorizontal: 5,
    textTransform: "uppercase",
    color: PDF_COLORS.gray700,
  },
  td: {
    fontSize: 9,
    paddingVertical: 7,
    paddingHorizontal: 5,
  },
  colInvoice: { width: "22%" },
  colDate: { width: "18%" },
  colDue: { width: "18%" },
  colOverdue: { width: "16%" },
  colAmount: { width: "26%" },
  ultimatumBox: {
    borderWidth: 1.5,
    borderColor: PDF_COLORS.black,
    padding: 12,
    marginVertical: 12,
  },
  ultimatumText: {
    fontSize: 10,
    fontWeight: 700,
    textAlign: "center",
    lineHeight: 1.55,
  },
  signatureBlock: {
    marginTop: 22,
    alignItems: "flex-end",
  },
  signatureImage: {
    width: 120,
    height: 48,
    objectFit: "contain",
    marginBottom: 6,
    alignSelf: "flex-end",
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.black,
    width: 240,
    marginTop: 32,
    paddingTop: 8,
    alignItems: "flex-end",
  },
  signatureName: {
    fontWeight: 700,
    fontSize: 10.5,
  },
  signatureTitle: {
    fontSize: 9,
    color: PDF_COLORS.gray700,
    marginTop: 2,
    textAlign: "right",
  },
});

function Clause({
  number,
  children,
}: {
  number: number;
  children: string;
}) {
  return (
    <Text style={styles.clause}>
      <Text style={styles.clauseNum}>{number}. </Text>
      {children}
    </Text>
  );
}

export function LegalNoticePDF(props: LegalNoticePDFProps) {
  const invoiceRef = safePdfText(props.invoiceNumber, "As per books of account");
  const debtorAddress = safePdfText(
    props.debtorAddress,
    "Address on record as per trade correspondence"
  );
  const claimantAddress = safePdfText(props.claimantAddress, "Address on record");
  const debtorGstin = safePdfText(props.debtorGstin, "Not available on record");
  const claimantGstin = safePdfText(props.claimantGstin, "Not available on record");
  const refNo = `RN/${props.invoiceNumber ?? "GEN"}/${props.noticeDate.replace(/\s/g, "")}`;
  const principalDue = formatPdfRupee(props.balanceDue);

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.letterhead}>
          <Text style={styles.advocateName}>ADV. ANIL D. KAMBLE</Text>
          <Text style={styles.advocateLine}>B.Com., LL.B. | Advocate & Legal Consultant</Text>
          <Text style={styles.advocateLine}>
            Chamber & Legal Representative for Recoverpe Platform
          </Text>
        </View>
        <View style={styles.rule} />
        <View style={styles.rule} />
        <View style={styles.thinRule} />

        <View style={styles.metaRow}>
          <Text>
            <Text style={styles.metaLabel}>Ref No: </Text>
            {refNo}
          </Text>
          <Text>
            <Text style={styles.metaLabel}>Date: </Text>
            {props.noticeDate}
          </Text>
        </View>

        <View style={styles.noticeBanner}>
          <Text style={styles.noticeBannerText}>
            REGISTERED SPEED POST A.D. / LEGAL DEMAND NOTICE
          </Text>
        </View>

        <Text style={styles.addresseeLabel}>To,</Text>
        <Text style={{ ...styles.clause, marginBottom: 12 }}>
          {props.debtorName}
          {"\n"}
          {debtorAddress}
          {"\n"}
          Mobile: {props.debtorPhone}
          {"\n"}
          GSTIN: {debtorGstin}
        </Text>

        <View style={styles.subjectBox}>
          <Text style={styles.subjectLabel}>Subject:</Text>
          <Text style={styles.clause}>
            Legal demand for recovery of overdue commercial dues of {principalDue}{" "}
            payable to our client M/s. {props.claimantName} (GSTIN: {claimantGstin}).
          </Text>
        </View>

        <Clause number={1}>
          {`Under instructions and on behalf of our client, M/s. ${props.claimantName}, having its registered address at ${claimantAddress}, I, Adv. Anil D. Kamble, Advocate, hereby serve upon you this formal Legal Demand Notice in respect of outstanding trade receivables arising from bonafide commercial transactions between the parties.`}
        </Clause>

        <Clause number={2}>
          The overdue particulars of the claim are tabulated below for your immediate
          reference and compliance:
        </Clause>

        <View style={styles.table} wrap={false}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colInvoice]}>Invoice No.</Text>
            <Text style={[styles.th, styles.colDate]}>Date</Text>
            <Text style={[styles.th, styles.colDue]}>Due Date</Text>
            <Text style={[styles.th, styles.colOverdue]}>Days Overdue</Text>
            <Text style={[styles.th, styles.colAmount]}>Principal Dues (Rs.)</Text>
          </View>
          <View style={styles.tableDataRow}>
            <Text style={[styles.td, styles.colInvoice]}>{invoiceRef}</Text>
            <Text style={[styles.td, styles.colDate]}>{props.invoiceDate}</Text>
            <Text style={[styles.td, styles.colDue]}>{props.dueDate}</Text>
            <Text style={[styles.td, styles.colOverdue]}>{String(props.daysOverdue)}</Text>
            <Text style={[styles.td, styles.colAmount]}>{principalDue}</Text>
          </View>
        </View>

        <Clause number={3}>
          {`You are put to strict notice that under Sections 15, 16 and 17 of the Micro, Small and Medium Enterprises Development Act, 2006 (MSMED Act), a buyer of goods or recipient of services from a micro or small enterprise is under a statutory obligation to make payment within forty-five (45) days of acceptance of goods/services or the day of deemed delivery. On failure, the buyer is liable to pay compound interest with monthly rests at three times the bank rate notified by the Reserve Bank of India. Your continued default in remitting ${principalDue} attracts these statutory consequences in addition to contractual liability.`}
        </Clause>

        <Clause number={4}>
          {`Further, take notice that persistent default in honouring commercial obligations may expose you to proceedings under Section 138 of the Negotiable Instruments Act, 1881 (where applicable), and civil recovery proceedings under Order XXXVII of the Code of Civil Procedure, 1908, seeking summary recovery of the decretal amount together with interest, costs, and damages.`}
        </Clause>

        <Clause number={5}>
          {`You are hereby called upon to pay the principal sum of ${principalDue} (Invoice Amount: ${formatPdfRupee(props.totalAmount)}) within seven (7) days from the date of receipt of this notice, by bank transfer or other verifiable mode to our client's designated account, with written intimation to this Chamber.`}
        </Clause>

        <View style={styles.ultimatumBox} wrap={false}>
          <Text style={styles.ultimatumText}>
            STRICT ULTIMATUM: Pay the principal sum of {principalDue} within Seven (7)
            Days from the date of this notice (on or before {props.settlementDeadline}).
          </Text>
        </View>

        <Clause number={6}>
          Take notice that upon failure to comply, our client shall be constrained to
          initiate appropriate civil and criminal proceedings, MSME Facilitation Council
          remedies under Section 18 of the MSMED Act, and Samadhaan portal escalation,
          without further reference to you. All interest, penalties, legal costs, and
          consequences shall be to your sole account.
        </Clause>

        <Clause number={7}>
          This notice is issued without prejudice to all other rights, remedies, and
          claims available to our client in law and equity, all of which are expressly
          reserved.
        </Clause>

        <View style={styles.signatureBlock} wrap={false}>
          <Text style={styles.clause}>Yours faithfully,</Text>
          <View style={styles.signatureLine}>
            {props.signatureImageSrc ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
              <Image src={props.signatureImageSrc} style={styles.signatureImage} />
            ) : null}
            <Text style={styles.signatureName}>Adv. Anil D. Kamble</Text>
            <Text style={styles.signatureTitle}>
              Legal Counsel & Representative for Recoverpe
            </Text>
            <Text style={styles.signatureTitle}>
              B.Com., LL.B. | Advocate & Legal Consultant
            </Text>
            <Text style={styles.signatureTitle}>
              For and on behalf of M/s. {props.claimantName}
            </Text>
            <Text style={styles.signatureTitle}>Date: {props.noticeDate}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
