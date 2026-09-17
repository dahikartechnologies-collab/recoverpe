"use client";

import { useState } from "react";
import { PaymentSuccessCelebration } from "@/components/pay/PaymentSuccessCelebration";
import { SmartCheckoutRails } from "@/components/pay/SmartCheckoutRails";
import { usePaymentStatusPolling } from "@/hooks/use-payment-status-polling";
import { formatCurrency } from "@/lib/gst";
import { isZeroMdrCheckoutEligible } from "@/lib/entitlements";
import { DebtorPortalInvoice, DebtorPortalView } from "@/types";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

interface DebtorPortalViewProps {
  view: DebtorPortalView;
}

function InvoiceStatusBadge({ invoice }: { invoice: DebtorPortalInvoice }) {
  const isPaid = invoice.balance_due <= 0;
  const isPartial = !isPaid && (invoice.amount_paid ?? 0) > 0;
  const isOverdue = !isPaid && !isPartial && invoice.status === "overdue";

  const tone: BadgeTone = isPaid
    ? "success"
    : isPartial
      ? "warning"
      : isOverdue
        ? "danger"
        : "neutral";
  const label = isPaid
    ? "Paid"
    : isPartial
      ? "Partial"
      : isOverdue
        ? "Overdue"
        : "Pending";

  return <Badge tone={tone}>{label}</Badge>;
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
    <div className="min-h-screen bg-recoverpe-canvas text-recoverpe-black">
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-6 sm:px-6">
        <header className="border-b border-recoverpe-line pb-5">
          <p className="type-eyebrow">
            Statement of Account
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{view.merchant_name}</h1>
          <p className="mt-1 text-sm text-recoverpe-muted">
            Prepared for {view.contact_name}
          </p>
        </header>

        <section className="border-b border-recoverpe-line py-6">
          <p className="text-sm text-recoverpe-muted">Net Balance Due</p>
          <p className="type-stat mt-1">
            {formatCurrency(view.total_outstanding)}
          </p>

          <dl className="mt-5 grid grid-cols-2 overflow-hidden rounded-xl border border-recoverpe-line bg-recoverpe-white divide-x divide-recoverpe-line">
            <div className="px-4 py-3">
              <dt className="type-eyebrow">Total Invoiced</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums">
                {formatCurrency(view.total_invoiced)}
              </dd>
            </div>
            <div className="px-4 py-3">
              <dt className="type-eyebrow">Total Paid</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-recoverpe-success-ink">
                {formatCurrency(view.total_paid)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="flex-1 py-6">
          <h2 className="type-eyebrow">
            Open Invoices
          </h2>
          {view.open_invoices.length === 0 ? (
            <p className="mt-4 text-sm text-recoverpe-muted">
              No open invoices at this time.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-recoverpe-line overflow-hidden rounded-xl border border-recoverpe-line bg-recoverpe-white">
              {view.open_invoices.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex items-start justify-between gap-4 px-4 py-4"
                >
                  <div>
                    <p className="font-medium">
                      {invoice.invoice_number ?? `Invoice ${invoice.id.slice(0, 8)}`}
                    </p>
                    <p className="mt-1 text-sm text-recoverpe-muted">
                      Due {invoice.due_date}
                    </p>
                    <div className="mt-2">
                      <InvoiceStatusBadge invoice={invoice} />
                    </div>
                  </div>
                  <p className="type-data-primary text-sm">
                    {formatCurrency(invoice.balance_due)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {view.invoice_history.length > 0 ? (
          <section className="border-t border-recoverpe-line py-6">
            <button
              type="button"
              onClick={() => setIsHistoryOpen((open) => !open)}
              className="rp-interactive flex w-full items-center justify-between gap-3 text-left hover:text-recoverpe-black"
              aria-expanded={isHistoryOpen}
            >
              <span className="type-eyebrow">
                Full Invoice History ({view.invoice_history.length})
              </span>
              <span className="text-sm text-recoverpe-muted">
                {isHistoryOpen ? "Hide" : "Show"}
              </span>
            </button>

            {isHistoryOpen ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-recoverpe-line bg-recoverpe-white">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Invoice</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.invoice_history.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <p className="font-medium">
                            {invoice.invoice_number ??
                              `INV-${invoice.id.slice(0, 8).toUpperCase()}`}
                          </p>
                          <p className="mt-0.5 text-xs text-recoverpe-muted">
                            Due {invoice.due_date}
                          </p>
                        </TableCell>
                        <TableCell>
                          <InvoiceStatusBadge invoice={invoice} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <p className="font-semibold">
                            {formatCurrency(invoice.total_amount ?? 0)}
                          </p>
                          {invoice.balance_due > 0 ? (
                            <p className="mt-0.5 text-xs text-recoverpe-muted">
                              {formatCurrency(invoice.balance_due)} due
                            </p>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </section>
        ) : null}

        {view.total_outstanding > 0 ? (
          <section className="mt-auto rounded-xl border border-recoverpe-line bg-recoverpe-white p-5">
            <h2 className="type-section-title">Pay Outstanding Balance</h2>
            <p className="mt-2 text-sm leading-6 text-recoverpe-muted">
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
              <p className="mt-4 text-center text-xs text-recoverpe-muted">
                Waiting for your bank transfer? This page will celebrate automatically
                once payment is received.
              </p>
            ) : null}
          </section>
        ) : null}

        <footer className="pt-6 text-center text-xs text-recoverpe-muted">
          Secure debtor portal · Powered by Recoverpe
        </footer>
      </div>
    </div>
  );
}
