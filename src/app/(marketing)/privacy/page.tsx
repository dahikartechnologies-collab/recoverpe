import { LegalPageLayout } from "@/components/marketing/LegalPageLayout";

export const metadata = {
  title: "Privacy Policy | Recoverpe",
  description: "Privacy Policy for the Recoverpe platform.",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="14 August 2026">
      <p>
        Dahikar Technologies Pvt. Ltd. (&quot;Recoverpe&quot;, &quot;we&quot;,
        &quot;us&quot;) respects your privacy and is committed to protecting
        personal data in accordance with the Digital Personal Data Protection
        Act, 2023 (&quot;DPDP Act&quot;) and other applicable Indian laws.
      </p>

      <h2>1. Data We Collect</h2>
      <p>We may collect the following categories of information:</p>
      <ul>
        <li>
          <strong>Account data:</strong> name, email, phone number, billing
          address, authentication identifiers.
        </li>
        <li>
          <strong>Business data:</strong> GSTIN, MSME registration, invoice
          details, ledger entries, and uploaded documents.
        </li>
        <li>
          <strong>Contact data:</strong> debtor names, phone numbers, and
          communication history you upload or generate through the Service.
        </li>
        <li>
          <strong>Payment data:</strong> transaction references processed by
          Razorpay. We do not store full card details on our servers.
        </li>
        <li>
          <strong>Technical data:</strong> device information, logs, and usage
          analytics necessary to secure and improve the Service.
        </li>
      </ul>

      <h2>2. Purpose of Processing</h2>
      <p>We process personal data to:</p>
      <ul>
        <li>Provide and maintain the Recoverpe platform.</li>
        <li>Send reminders, calls, and documents on your instructions.</li>
        <li>Process subscriptions and micro-transactions.</li>
        <li>Prevent fraud, enforce terms, and comply with legal obligations.</li>
        <li>Improve product performance and customer support.</li>
      </ul>

      <h2>3. Legal Basis</h2>
      <p>
        Processing is based on your consent, contractual necessity, compliance
        with law, and legitimate interests such as security and service
        improvement, as permitted under the DPDP Act.
      </p>

      <h2>4. Data Sharing</h2>
      <p>We may share data with trusted processors including:</p>
      <ul>
        <li>Firebase (authentication and storage)</li>
        <li>Supabase (database infrastructure)</li>
        <li>Razorpay (payments)</li>
        <li>Meta WhatsApp Cloud API (message delivery)</li>
        <li>Vapi (AI voice calling)</li>
      </ul>
      <p>
        We do not sell personal data. Disclosure may also occur where required by
        law, court order, or to protect rights and safety.
      </p>

      <h2>5. Data Retention</h2>
      <p>
        We retain data for as long as your account is active and as needed to
        provide the Service. When you request account deletion, your account is
        scheduled for purge and permanently deleted after the statutory grace
        period, subject to legal retention requirements.
      </p>

      <h2>6. Security</h2>
      <p>
        We implement administrative, technical, and organizational safeguards
        including encryption in transit, access controls, and server-side
        environment isolation. No method of transmission over the internet is
        completely secure.
      </p>

      <h2>7. Your Rights</h2>
      <p>Subject to applicable law, you may have the right to:</p>
      <ul>
        <li>Access and correct your personal data.</li>
        <li>Withdraw consent where processing is consent-based.</li>
        <li>Request erasure of your account and associated data.</li>
        <li>Lodge a grievance with our designated contact point.</li>
      </ul>

      <h2>8. Children&apos;s Privacy</h2>
      <p>
        The Service is not directed to individuals under 18 years of age. We do
        not knowingly collect personal data from children.
      </p>

      <h2>9. International Transfers</h2>
      <p>
        Where data is processed outside India through subprocessors, we take
        reasonable steps to ensure appropriate safeguards consistent with
        applicable law.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes
        will be posted on this page with an updated effective date.
      </p>

      <h2>11. Grievance Officer / Contact</h2>
      <p>
        For privacy requests or grievances, contact{" "}
        <a href="mailto:admin@recoverpe.com">admin@recoverpe.com</a> or write to
        us at the address listed on our <a href="/contact">Contact page</a>.
      </p>
    </LegalPageLayout>
  );
}
