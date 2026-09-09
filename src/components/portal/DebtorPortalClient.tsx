"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/gst";
import {
  generateUPIQRCodeBase64,
  generateVirtualAccountUpiUri,
} from "@/lib/upi";
import { DebtorPortalView } from "@/types";

interface DebtorPortalViewProps {
  view: DebtorPortalView;
}

export function DebtorPortalClient({ view }: DebtorPortalViewProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function renderQr() {
      if (!view.virtual_upi_id) {
        setQrDataUrl(null);
        setQrError("Smart Collect payment details are not available yet.");
        return;
      }

      try {
        const upiUri = generateVirtualAccountUpiUri(
          view.virtual_upi_id,
          view.merchant_name,
          view.total_outstanding > 0 ? view.total_outstanding : undefined
        );
        const dataUrl = await generateUPIQRCodeBase64(upiUri);

        if (!cancelled) {
          setQrDataUrl(dataUrl);
          setQrError("");
        }
      } catch {
        if (!cancelled) {
          setQrDataUrl(null);
          setQrError("Unable to render payment QR code.");
        }
      }
    }

    void renderQr();

    return () => {
      cancelled = true;
    };
  }, [view.merchant_name, view.total_outstanding, view.virtual_upi_id]);

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
          <p className="text-sm text-recoverpe-grey-medium">Total Outstanding</p>
          <p className="mt-1 text-3xl font-semibold">
            {formatCurrency(view.total_outstanding)}
          </p>
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

        <section className="mt-auto rounded-lg border border-recoverpe-grey-light bg-recoverpe-white p-5">
          <h2 className="text-base font-semibold">Pay via Smart Collect</h2>
          <p className="mt-2 text-sm leading-6 text-recoverpe-grey-medium">
            Scan this QR or use the UPI ID to pay. Your ledger will be updated
            automatically.
          </p>

          {view.virtual_upi_id ? (
            <div className="mt-5 flex flex-col items-center">
              <div className="flex h-44 w-44 items-center justify-center rounded-lg border border-recoverpe-grey-light bg-recoverpe-white p-3">
                {qrDataUrl ? (
                  <Image
                    src={qrDataUrl}
                    alt="Smart Collect UPI QR code"
                    width={160}
                    height={160}
                    unoptimized
                    className="h-40 w-40"
                  />
                ) : (
                  <p className="px-3 text-center text-xs text-recoverpe-grey-medium">
                    {qrError || "Generating QR code..."}
                  </p>
                )}
              </div>
              <p className="mt-4 break-all text-center font-mono text-sm">
                {view.virtual_upi_id}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-recoverpe-grey-medium">
              Virtual payment details are not configured for this account yet.
            </p>
          )}

          {view.virtual_account_number && view.ifsc_code ? (
            <div className="mt-5 space-y-2 rounded-lg border border-recoverpe-grey-light px-4 py-3 text-sm">
              <p>
                <span className="text-recoverpe-grey-medium">Account:</span>{" "}
                <span className="font-mono">{view.virtual_account_number}</span>
              </p>
              <p>
                <span className="text-recoverpe-grey-medium">IFSC:</span>{" "}
                <span className="font-mono">{view.ifsc_code}</span>
              </p>
            </div>
          ) : null}
        </section>

        <footer className="pt-6 text-center text-xs text-recoverpe-grey-medium">
          Secure debtor portal · Powered by Recoverpe
        </footer>
      </div>
    </div>
  );
}
