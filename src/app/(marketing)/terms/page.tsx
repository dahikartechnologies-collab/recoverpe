import { LegalPageLayout } from "@/components/marketing/LegalPageLayout";

export const metadata = {
  title: "Terms and Conditions | Recoverpe",
  description: "Terms and Conditions for using the Recoverpe platform.",
};

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms and Conditions" lastUpdated="14 August 2026">
      <p>
        These Terms and Conditions (&quot;Terms&quot;) govern your access to and
        use of the Recoverpe platform (&quot;Service&quot;), operated by Dahikar
        Technologies Pvt. Ltd. (&quot;Company&quot;, &quot;we&quot;, &quot;us&quot;, or
        &quot;our&quot;). By creating an account or using the Service, you agree
        to be bound by these Terms.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 18 years of age and legally capable of entering into
        a binding contract under Indian law. The Service is intended for
        businesses, proprietors, and authorized representatives of Indian MSMEs
        engaged in lawful commercial collections activity.
      </p>

      <h2>2. Account Registration</h2>
      <p>
        You agree to provide accurate, current, and complete information during
        registration and to keep your account credentials secure. You are
        responsible for all activity conducted under your account.
      </p>

      <h2>3. Description of Service</h2>
      <p>
        Recoverpe provides software tools for ledger management, automated
        WhatsApp reminders, AI-assisted voice outreach, document generation,
        payment link sharing, and related collections workflows. We do not provide
        legal advice. Formal notices generated through the platform are based on
        information you supply and should be reviewed for accuracy before
        dispatch.
      </p>

      <h2>4. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for harassment, fraud, or unlawful debt collection.</li>
        <li>Upload false, misleading, or defamatory debtor information.</li>
        <li>Circumvent usage limits, security controls, or billing mechanisms.</li>
        <li>Violate applicable telecom, data protection, or consumer protection laws.</li>
      </ul>

      <h2>5. Subscriptions and Payments</h2>
      <p>
        Paid plans, micro-transactions, and add-on purchases are processed via
        Razorpay. Pricing displayed in the application at the time of purchase
        is final. Taxes, where applicable, may be charged additionally as per
        Indian law.
      </p>

      <h2>6. Communications Compliance</h2>
      <p>
        Automated communications may be subject to TRAI regulations and platform
        policies. You are responsible for ensuring that your use of reminders,
        calls, and notices complies with applicable law and that you have a
        lawful basis to contact the recipients you upload.
      </p>

      <h2>7. Intellectual Property</h2>
      <p>
        The Service, including software, branding, templates, and documentation,
        remains the property of Dahikar Technologies Pvt. Ltd. You retain ownership of your
        business data uploaded to the platform.
      </p>

      <h2>8. Data and Privacy</h2>
      <p>
        Our collection and use of personal data is described in our{" "}
        <a href="/privacy">Privacy Policy</a>. By using the Service, you consent
        to such processing in accordance with applicable law, including the
        Digital Personal Data Protection Act, 2023.
      </p>

      <h2>9. Suspension and Termination</h2>
      <p>
        We may suspend or terminate access for violations of these Terms, abuse,
        non-payment, or legal requirements. You may request account deletion at
        any time; deletion is subject to our data retention and purge policies.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        The Service is provided on an &quot;as is&quot; and &quot;as available&quot;
        basis. We do not guarantee recovery of any specific amount, delivery of
        every message, or legal outcomes from notices issued through the platform.
      </p>

      <h2>11. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, Dahikar Technologies Pvt. Ltd. shall not be
        liable for indirect, incidental, special, or consequential damages arising
        from your use of the Service. Our aggregate liability shall not exceed
        the fees paid by you in the twelve (12) months preceding the claim.
      </p>

      <h2>12. Governing Law</h2>
      <p>
        These Terms are governed by the laws of India. Courts at Nagpur,
        Maharashtra shall have exclusive jurisdiction, subject to applicable
        consumer protection remedies.
      </p>

      <h2>13. Contact</h2>
      <p>
        For questions regarding these Terms, contact us at{" "}
        <a href="mailto:admin@recoverpe.com">admin@recoverpe.com</a> or visit
        our <a href="/contact">Contact page</a>.
      </p>
    </LegalPageLayout>
  );
}
