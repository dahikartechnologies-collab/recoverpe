import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  STANDEE_EMERALD,
  STANDEE_NAVY,
  STANDEE_TEAL,
} from "@/lib/khata-standee";
import { registerPdfDefaults, safePdfText } from "@/components/pdf/pdf-shared";

registerPdfDefaults();

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    padding: 0,
  },
  header: {
    backgroundColor: STANDEE_NAVY,
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 36,
    alignItems: "center",
  },
  kicker: {
    color: STANDEE_EMERALD,
    fontSize: 9,
    letterSpacing: 2.4,
    fontWeight: 700,
  },
  merchant: {
    marginTop: 10,
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: 700,
    textAlign: "center",
  },
  accent: {
    height: 6,
    backgroundColor: STANDEE_EMERALD,
  },
  body: {
    paddingHorizontal: 40,
    paddingTop: 28,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  qr: {
    width: 220,
    height: 220,
  },
  scanTitle: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: 700,
    color: "#0A0A0A",
  },
  scanSub: {
    marginTop: 4,
    fontSize: 9,
    color: STANDEE_TEAL,
  },
  accepted: {
    marginTop: 22,
    fontSize: 9,
    letterSpacing: 1.6,
    fontWeight: 700,
    color: "#0A0A0A",
  },
  badges: {
    marginTop: 10,
    flexDirection: "row",
  },
  badge: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginHorizontal: 4,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: 700,
    color: STANDEE_TEAL,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    borderTopWidth: 2,
    borderTopColor: STANDEE_TEAL,
    paddingTop: 16,
    alignItems: "center",
  },
  logo: {
    height: 72,
    width: 72,
  },
  powered: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: 700,
    color: "#0A0A0A",
  },
});

interface KhataStandeePDFProps {
  businessName: string;
  qrDataUrl: string;
  logoDataUrl?: string | null;
}

export function KhataStandeePDF({
  businessName,
  qrDataUrl,
  logoDataUrl,
}: KhataStandeePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>KHATA PAYMENT STAND</Text>
          <Text style={styles.merchant}>
            {safePdfText(businessName, "Merchant")}
          </Text>
        </View>
        <View style={styles.accent} />
        <View style={styles.body}>
          <View style={styles.card}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
            <Image src={qrDataUrl} style={styles.qr} />
            <Text style={styles.scanTitle}>Scan to Pay & Open Khata</Text>
            <Text style={styles.scanSub}>UPI · Instant settlement · Digital ledger</Text>
          </View>
          <Text style={styles.accepted}>ACCEPTED HERE</Text>
          <View style={styles.badges}>
            {["UPI", "RuPay", "BHIM", "BharatQR"].map((badge) => (
              <View key={badge} style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.footer} fixed>
          {logoDataUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
            <Image src={logoDataUrl} style={styles.logo} />
          ) : null}
          <Text style={styles.powered}>Powered by RecoverPe</Text>
        </View>
      </Page>
    </Document>
  );
}
