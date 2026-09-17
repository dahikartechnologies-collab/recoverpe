"use client";

import { FormEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import type { AgentMeResponse } from "@/lib/agent-client";

function maskAccountNumber(value: string | null): string {
  if (!value) {
    return "—";
  }

  if (value.length <= 4) {
    return value;
  }

  return `${"•".repeat(Math.max(value.length - 4, 4))}${value.slice(-4)}`;
}

interface AgentKycTabProps {
  payload: AgentMeResponse;
  bankAccountName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  isSavingProfile: boolean;
  uploadingKycSide: "front" | "back" | null;
  setBankAccountName: (value: string) => void;
  setBankAccountNumber: (value: string) => void;
  setBankIfsc: (value: string) => void;
  onSaveBankProfile: (event: FormEvent<HTMLFormElement>) => void;
  onKycUpload: (side: "front" | "back", file: File | null) => void;
}

export function AgentKycTab({
  payload,
  bankAccountName,
  bankAccountNumber,
  bankIfsc,
  isSavingProfile,
  uploadingKycSide,
  setBankAccountName,
  setBankAccountNumber,
  setBankIfsc,
  onSaveBankProfile,
  onKycUpload,
}: AgentKycTabProps) {
  const { agent } = payload;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="type-section-title">Bank account & payout details</h2>
          <p className="mt-1 text-sm text-recoverpe-muted">
            Commissions settle to this bank account. UPI payouts are routed through
            the linked account on file.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSaveBankProfile}>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-recoverpe-black">
                Account holder name
              </span>
              <Input
                className="mt-1"
                value={bankAccountName}
                onChange={(event) => setBankAccountName(event.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-recoverpe-black">Account number</span>
              <Input
                className="mt-1 font-mono tracking-wide"
                value={bankAccountNumber}
                onChange={(event) => setBankAccountNumber(event.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-recoverpe-black">IFSC</span>
              <Input
                className="mt-1 font-mono uppercase tracking-wide"
                value={bankIfsc}
                onChange={(event) => setBankIfsc(event.target.value.toUpperCase())}
                required
              />
            </label>
            <div className="rounded-xl border border-recoverpe-line bg-recoverpe-canvas px-3 py-2.5 text-sm sm:col-span-2">
              <span className="text-recoverpe-muted">Saved account: </span>
              <span className="font-mono font-medium tracking-wide text-recoverpe-black">
                {maskAccountNumber(agent.bank_account_number)}
              </span>
            </div>
            <Button
              type="submit"
              className="sm:col-span-2"
              disabled={isSavingProfile}
            >
              {isSavingProfile ? "Saving…" : "Save bank details"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="type-section-title">Document verification</h2>
          <p className="mt-1 text-sm text-recoverpe-muted">
            Upload PAN and government ID to activate your field agent profile.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {(["front", "back"] as const).map((side) => {
            const uploaded = Boolean(agent.kyc_documents[side]);

            return (
              <label
                key={side}
                className="rp-interactive block cursor-pointer rounded-xl border border-dashed border-recoverpe-line-strong bg-recoverpe-canvas p-4 text-sm hover:border-recoverpe-black hover:bg-recoverpe-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-medium capitalize text-recoverpe-black">
                      {side} of Aadhar/PAN
                    </span>
                    <p className="mt-1 text-recoverpe-muted">
                      {uploaded
                        ? "Verified upload on file"
                        : "JPG, PNG, or PDF · max 4MB"}
                    </p>
                  </div>
                  <Badge tone={uploaded ? "success" : "neutral"}>
                    {uploaded ? "Uploaded" : "Pending"}
                  </Badge>
                </div>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  disabled={uploadingKycSide === side}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    onKycUpload(side, file);
                    event.target.value = "";
                  }}
                />
                <p className="mt-4 text-xs font-medium text-recoverpe-black">
                  {uploadingKycSide === side
                    ? "Uploading…"
                    : uploaded
                      ? "Replace document"
                      : "Choose file"}
                </p>
              </label>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
