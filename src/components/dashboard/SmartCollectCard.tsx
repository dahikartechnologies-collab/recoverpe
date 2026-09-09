"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { VirtualAccount } from "@/types";

interface SmartCollectCardProps {
  virtualAccount: VirtualAccount | null;
  businessName: string | null;
  isProvisioning: boolean;
  isGeneratingPortalLink: boolean;
  onProvision: () => void;
  onGeneratePortalLink: () => void;
}

interface CopyFieldProps {
  label: string;
  value: string;
}

function CopyField({ label, value }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-recoverpe-grey-light px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-recoverpe-grey-medium">
        {label}
      </p>
      <div className="mt-2 flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 flex-1 truncate font-mono text-sm tabular-nums tracking-tight text-recoverpe-black">
          {value}
        </p>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-recoverpe-grey-light px-2.5 py-1.5 text-xs font-medium text-recoverpe-black transition hover:bg-recoverpe-grey-light/40"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function SmartCollectCard({
  virtualAccount,
  businessName,
  isProvisioning,
  isGeneratingPortalLink,
  onProvision,
  onGeneratePortalLink,
}: SmartCollectCardProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-recoverpe-black">
          Smart Collect &amp; Auto-Reconciliation
        </h2>
        <p className="mt-1 text-sm text-recoverpe-grey-medium">
          Dedicated virtual payment details for{" "}
          {businessName ?? "your business workspace"}. Incoming payments are
          auto-matched to the oldest open invoices.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!virtualAccount ? (
          <div className="space-y-3">
            <p className="text-sm text-recoverpe-grey-medium">
              Generate a dedicated UPI ID and virtual bank account for this vendor.
            </p>
            <button
              type="button"
              onClick={onProvision}
              disabled={isProvisioning}
              className="inline-flex items-center justify-center rounded-lg bg-recoverpe-black px-4 py-2.5 text-sm font-medium text-recoverpe-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isProvisioning ? "Generating..." : "Generate Virtual Payment Details"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {virtualAccount.virtual_upi_id ? (
              <CopyField label="Virtual UPI ID" value={virtualAccount.virtual_upi_id} />
            ) : null}
            {virtualAccount.virtual_account_number ? (
              <CopyField
                label="Virtual Account Number"
                value={virtualAccount.virtual_account_number}
              />
            ) : null}
            {virtualAccount.ifsc_code ? (
              <CopyField label="IFSC Code" value={virtualAccount.ifsc_code} />
            ) : null}
          </div>
        )}

        <div className="border-t border-recoverpe-grey-light pt-4">
          <p className="text-sm text-recoverpe-grey-medium">
            Share a secure, read-only debtor portal link via WhatsApp.
          </p>
          <button
            type="button"
            onClick={onGeneratePortalLink}
            disabled={isGeneratingPortalLink}
            className="mt-3 inline-flex items-center justify-center rounded-lg border border-recoverpe-black px-4 py-2.5 text-sm font-medium text-recoverpe-black transition hover:bg-recoverpe-grey-light/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGeneratingPortalLink ? "Generating..." : "Generate Portal Link"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
