import { LegalPageLayout } from "@/components/marketing/LegalPageLayout";

export const metadata = {
  title: "Cancellation & Refund Policy | Recoverpe",
  description: "Cancellation and refund policy for Recoverpe subscriptions and purchases.",
};

export default function RefundsPage() {
  return (
    <LegalPageLayout
      title="Cancellation & Refund Policy"
      lastUpdated="14 August 2026"
    >
      <p>
        This Cancellation &amp; Refund Policy applies to purchases made on the
        Recoverpe platform operated by Dahikar Technologies Pvt. Ltd. By completing a
        payment, you agree to the terms below.
      </p>

      <h2>1. Premium Subscriptions</h2>
      <h3>Monthly Plan (₹1,999/month)</h3>
      <p>
        Premium subscriptions renew automatically each billing cycle until
        cancelled. You may cancel at any time from the Billing section of your
        dashboard. Cancellation stops future charges; access continues until the
        end of the current paid period.
      </p>
      <h3>Annual Plan (₹17,999/year)</h3>
      <p>
        Annual subscriptions are billed upfront for twelve (12) months. You may
        cancel renewal before the next annual cycle. No partial refunds are
        provided for unused months after activation unless required by law.
      </p>

      <h2>2. Pay-Per-Use Purchases</h2>
      <h3>Legal Notice (₹999)</h3>
      <p>
        Once payment is confirmed and document generation has commenced or
        completed, this purchase is generally non-refundable because it involves
        immediate digital fulfillment and third-party processing costs.
      </p>
      <h3>Samadhaan Kit (₹499)</h3>
      <p>
        Similarly, the Samadhaan evidence docket is delivered digitally upon
        successful payment. Refunds are not available after the PDF has been
        generated and made available in your account.
      </p>

      <h2>3. Failed or Duplicate Charges</h2>
      <p>
        If you were charged due to a technical error, duplicate transaction, or
        failed fulfillment where no service was delivered, contact us within
        seven (7) days at{" "}
        <a href="mailto:admin@recoverpe.com">admin@recoverpe.com</a> with your
        Razorpay order ID. Verified cases will be refunded to the original
        payment method within seven to ten (7–10) business days.
      </p>

      <h2>4. Chargebacks</h2>
      <p>
        Initiating an unjustified chargeback may result in account suspension
        pending investigation. We cooperate with Razorpay and banks to resolve
        disputes with supporting transaction logs.
      </p>

      <h2>5. AI Credits and Wallet Top-Ups</h2>
      <p>
        VAPI voice credits consumed after purchase are non-refundable. Unused
        wallet balances may be reviewed for refund on a case-by-case basis where
        no service consumption has occurred.
      </p>

      <h2>6. Free Plan</h2>
      <p>
        The Free plan does not involve payment. No refunds apply.
      </p>

      <h2>7. How to Request a Refund</h2>
      <p>Email the following to admin@recoverpe.com:</p>
      <ul>
        <li>Registered account email and phone number</li>
        <li>Razorpay order or payment ID</li>
        <li>Date and amount of transaction</li>
        <li>Reason for the refund request</li>
      </ul>

      <h2>8. Contact</h2>
      <p>
        For billing questions, visit our <a href="/contact">Contact page</a> or
        email <a href="mailto:admin@recoverpe.com">admin@recoverpe.com</a>.
      </p>
    </LegalPageLayout>
  );
}
