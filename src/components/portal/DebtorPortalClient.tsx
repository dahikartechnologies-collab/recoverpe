"use client";

import { useState } from "react";
import { PaymentSuccessCelebration } from "@/components/pay/PaymentSuccessCelebration";
import { SmartCheckoutRails } from "@/components/pay/SmartCheckoutRails";
import { usePaymentStatusPolling } from "@/hooks/use-payment-status-polling";
import { formatCurrency } from "@/lib/gst";
import { isZeroMdrCheckoutEligible } from "@/lib/entitlements";
import { DebtorPortalInvoice, DebtorPortalView } from "@/types";

interface DebtorPortalViewProps {
  view: DebtorPortalView;
}

function InvoiceStatusBadge({ invoice }: { invoice: DebtorPortalInvoice }) {
  const isPaid = invoice.balance_due <= 0;
  const isPartial = !isPaid && (invoice.amount_paid ?? 0) > 0;
  const isOverdue =
    !isPaid && !isPartial && invoice.status === "overdue";

  const { label, className } = isPaid
    ? { label: "PAID", className: "border-[#10B981] bg-[#ECFDF5] text-[#047857]" }
    : isPartial
      ? { label: "PARTIAL", className: "border-[#F59E0B] bg-[#FFFBEB] text-[#B45309]" }
      : isOverdue
        ? { label: "OVERDUE", className: "border-[#EF4444] bg-[#FEF2F2] text-[#B91C1C]" }
        : {
            label: "PENDING",
            className:
              "border-recoverpe-grey-light bg-recoverpe-white text-recoverpe-grey-medium",
          };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

export function DebtorPortalClient({ view }: DebtorPortalViewProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [celebrationAmount, setCelebrationAmount] = useState<number | null>(null);
  const [isPaid, setIsPaid] = useState(view.total_outstanding <= 0);
  const primaryInvoice = view.open_invoices[0] ?? null;
  const autoReconcileEligible = isZeroMdrCheckoutEligible(
    view.business_tier ? { subscription_tier: view.business_tier } : null
  );

  usePaymentStatusPolling({
    statusUrl: `/api/portal/${view.session_id}/status`,
    enabled: !isPaid && view.total_outstanding > 0,
    onPaid: () => {
      setCelebrationAmount(view.total_outstanding);
      setIsPaid(true);
    },
  });

  if (isPaid) {
    return (
      <PaymentSuccessCelebration
        amount={celebrationAmount ?? view.total_paid}
        subtitle="Your statement of account has been updated automatically."
      />
    );
  }

  return (
    <div className="min-h-screen bg-recoverpe-white text-recoverpe-black">
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-6 sm:px-6">
        <header className="border-b border-recoverpe-grey-light pb-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-recoverpe-grey-medium">
            Statement of Account
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{view.merchant_name}</h1>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Prepared for {view.contact_name}
          </p>
        </header>

        <section className="border-b border-recoverpe-grey-light py-6">
          <p className="text-sm text-recoverpe-grey-medium">Net Balance Due</p>
          <p className="mt-1 text-3xl font-semibold">
            {formatCurrency(view.total_outstanding)}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-recoverpe-grey-light px-4 py-3">
              <dt className="text-xs text-recoverpe-grey-medium">Total Invoiced</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums">
                {formatCurrency(view.total_invoiced)}
              </dd>
            </div>
            <div className="rounded-lg border border-recoverpe-grey-light px-4 py-3">
              <dt className="text-xs text-recoverpe-grey-medium">Total Paid</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-recoverpe-success">
                {formatCurrency(view.total_paid)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="flex-1 py-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-recoverpe-grey-medium">
            Open Invoices
          </h2>
          {view.open_invoices.length === 0 ? (
            <p className="mt-4 text-sm text-recoverpe-grey-medium">
              No open invoices at this time.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-recoverpe-grey-light border-y border-recoverpe-grey-light">
              {view.open_invoices.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex items-start justify-between gap-4 py-4"
                >
                  <div>
                    <p className="font-medium">
                      {invoice.invoice_number ?? `Invoice ${invoice.id.slice(0, 8)}`}
                    </p>
                    <p className="mt-1 text-sm text-recoverpe-grey-medium">
                      Due {invoice.due_date}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">
                    {formatCurrency(invoice.balance_due)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {view.invoice_history.length > 0 ? (
          <section className="border-t border-recoverpe-grey-light py-6">
            <button
              type="button"
              onClick={() => setIsHistoryOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-3 text-left"
              aria-expanded={isHistoryOpen}
            >
              <span className="text-sm font-semibold uppercase tracking-wide text-recoverpe-grey-medium">
                Full Invoice History ({view.invoice_history.length})
              </span>
              <span className="text-sm text-recoverpe-grey-medium">
                {isHistoryOpen ? "Hide" : "Show"}
              </span>
            </button>

            {isHistoryOpen ? (
              <div className="mt-4 overflow-x-auto rounded-lg border border-recoverpe-grey-light">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-recoverpe-grey-light/40">
                    <tr>
                      <th className="px-3 py-2 font-medium">Invoice</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-recoverpe-grey-light">
                    {view.invoice_history.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="px-3 py-3">
                          <p className="font-medium">
                            {invoice.invoice_number ??
                              `INV-${invoice.id.slice(0, 8).toUpperCase()}`}
                          </p>
                          <p className="mt-0.5 text-xs text-recoverpe-grey-medium">
                            Due {invoice.due_date}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <InvoiceStatusBadge invoice={invoice} />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          <p className="font-semibold">
                            {formatCurrency(invoice.total_amount ?? 0)}
                          </p>
                          {invoice.balance_due > 0 ? (
                            <p className="mt-0.5 text-xs text-recoverpe-grey-medium">
                              {formatCurrency(invoice.balance_due)} due
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        ) : null}

        {view.total_outstanding > 0 ? (
          <section className="mt-auto rounded-lg border border-recoverpe-grey-light bg-recoverpe-white p-5">
            <h2 className="text-base font-semibold">Pay Outstanding Balance</h2>
            <p className="mt-2 text-sm leading-6 text-recoverpe-grey-medium">
              {view.checkout.mode === "zero_mdr_bank"
                ? "Use the dedicated virtual account below for IMPS/NEFT/RTGS. Include the payment reference for instant reconciliation."
                : "Scan the QR code or pay via UPI. Your khata updates automatically once payment lands."}
            </p>

            <div className="mt-5">
              <SmartCheckoutRails
                amount={view.total_outstanding}
                maxAmount={view.total_outstanding}
                ledgerId={view.primary_ledger_id ?? view.session_id}
                invoiceNumber={primaryInvoice?.invoice_number ?? null}
                merchantName={view.merchant_name}
                businessTier={view.business_tier}
                merchantVpa={view.merchant_vpa}
                virtualBankAccountNumber={view.virtual_account_number}
                virtualIfscCode={view.ifsc_code}
              />
            </div>

            {autoReconcileEligible ? (
              <p className="mt-4 text-center text-xs text-recoverpe-grey-medium">
                Waiting for your bank transfer? This page will celebrate automatically
                once payment is received.
              </p>
            ) : null}
          </section>
        ) : null}

        <footer className="pt-6 text-center text-xs text-recoverpe-grey-medium">
          Secure debtor portal · Powered by Recoverpe
        </footer>
      </div>
    </div>
  );
}
