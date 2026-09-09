"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { ContactVirtualAccountDetails } from "@/types";

interface ContactVirtualAccountCardProps {
  details: ContactVirtualAccountDetails;
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
    <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-recoverpe-grey-medium">
        {label}
      </p>
      <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate font-mono text-xs tabular-nums tracking-tight text-recoverpe-black">
          {value}
        </p>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-recoverpe-black transition hover:bg-slate-50"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}

export function ContactVirtualAccountCard({
  details,
}: ContactVirtualAccountCardProps) {
  const hasBankDetails =
    Boolean(details.virtual_bank_account_number) ||
    Boolean(details.virtual_ifsc_code) ||
    Boolean(details.virtual_upi_id);

  if (!hasBankDetails) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-xs font-semibold text-recoverpe-black">
        Virtual Payment Details
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-recoverpe-grey-medium">
        Share for NEFT/RTGS/UPI. Payments auto-credit the khata wallet.
      </p>
      <div className="mt-2.5 space-y-2">
        {details.virtual_bank_account_number ? (
          <CopyField
            label="Account Number"
            value={details.virtual_bank_account_number}
          />
        ) : null}
        {details.virtual_ifsc_code ? (
          <CopyField label="IFSC" value={details.virtual_ifsc_code} />
        ) : null}
        {details.virtual_upi_id ? (
          <CopyField label="UPI ID" value={details.virtual_upi_id} />
        ) : null}
      </div>
    </div>
  );
}
