import { LegalPageLayout } from "@/components/marketing/LegalPageLayout";

export const metadata = {
  title: "Contact Us | Recoverpe",
  description: "Contact Recoverpe for support, billing, and legal inquiries.",
};

export default function ContactPage() {
  return (
    <LegalPageLayout title="Contact Us" lastUpdated="14 August 2026">
      <p>
        We are here to help with onboarding, billing, technical support, and
        compliance inquiries related to the Recoverpe platform.
      </p>

      <h2>Registered Business</h2>
      <p>
        <strong>Dahikar Technologies Pvt. Ltd.</strong>
        <br />
        Operating brand: Recoverpe
        <br />
        108, Laxminagar, Nagpur, Maharashtra 440022
        <br />
        India
      </p>

      <h2>Email</h2>
      <p>
        General &amp; Support:{" "}
        <a href="mailto:admin@recoverpe.com">admin@recoverpe.com</a>
        <br />
        Billing &amp; Refunds:{" "}
        <a href="mailto:admin@recoverpe.com">admin@recoverpe.com</a>
        <br />
        Privacy &amp; Data Requests:{" "}
        <a href="mailto:admin@recoverpe.com">admin@recoverpe.com</a>
      </p>

      <h2>Business Hours</h2>
      <p>
        Monday to Friday, 10:00 AM – 6:00 PM IST (excluding public holidays).
        We aim to respond to all emails within two (2) business days.
      </p>

      <h2>Payment Partner</h2>
      <p>
        All online payments on Recoverpe are securely processed by Razorpay
        Software Private Limited. For payment disputes, include your Razorpay
        order ID in your email so we can assist quickly.
      </p>

      <h2>Legal &amp; Policy Documents</h2>
      <ul>
        <li>
          <a href="/terms">Terms and Conditions</a>
        </li>
        <li>
          <a href="/privacy">Privacy Policy</a>
        </li>
        <li>
          <a href="/refunds">Cancellation &amp; Refund Policy</a>
        </li>
      </ul>
    </LegalPageLayout>
  );
}
