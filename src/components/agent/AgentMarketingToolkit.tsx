"use client";

import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { buildAgentReferralJoinUrl } from "@/lib/agent/referral-links";
import { Copy, Link2, QrCode } from "lucide-react";

interface AgentMarketingToolkitProps {
  referralCode: string;
  displayName: string;
}

export function AgentMarketingToolkit({
  referralCode,
  displayName,
}: AgentMarketingToolkitProps) {
  const [copied, setCopied] = useState(false);
  const referralUrl = buildAgentReferralJoinUrl(referralCode);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your referral link:", referralUrl);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-recoverpe-black" aria-hidden />
          <h2 className="type-section-title">Marketing toolkit</h2>
        </div>
        <p className="mt-1 text-sm text-recoverpe-muted">
          Share your digital agent QR or referral link so merchants can onboard
          instantly with {displayName}&apos;s code.
        </p>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[auto,1fr] md:items-center">
        <div className="mx-auto rounded-xl border border-recoverpe-line bg-recoverpe-white p-4">
          <QRCodeCanvas
            value={referralUrl}
            size={168}
            bgColor="#FFFFFF"
            fgColor="#0A0A0A"
            level="M"
            includeMargin
          />
        </div>

        <div className="space-y-4">
          <div>
            <p className="type-eyebrow">Digital agent QR</p>
            <p className="mt-2 text-sm text-recoverpe-muted">
              Show this QR on your phone. Merchants scan to open RecoverPe with your
              referral code pre-filled.
            </p>
          </div>

          <div className="rounded-xl border border-recoverpe-line bg-recoverpe-canvas px-3 py-2.5">
            <div className="flex items-start gap-2">
              <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-recoverpe-muted" />
              <p className="break-all font-mono text-sm text-recoverpe-black">
                {referralUrl.replace(/^https?:\/\//, "")}
              </p>
            </div>
          </div>

          <Button type="button" variant="secondary" onClick={() => void handleCopyLink()}>
            <Copy className="mr-2 h-4 w-4" />
            {copied ? "Copied!" : "Copy referral link"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
