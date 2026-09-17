"use client";

import { FormEvent } from "react";
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
          <h2 className="text-base font-semibold text-recoverpe-black">
            Bank account & payout details
          </h2>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
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
                className="mt-1"
                value={bankAccountNumber}
                onChange={(event) => setBankAccountNumber(event.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-recoverpe-black">IFSC</span>
              <Input
                className="mt-1 uppercase"
                value={bankIfsc}
                onChange={(event) => setBankIfsc(event.target.value.toUpperCase())}
                required
              />
            </label>
            <div className="rounded-md border border-recoverpe-grey-light px-3 py-2 text-sm sm:col-span-2">
              <span className="text-recoverpe-grey-medium">Saved account: </span>
              <span className="font-medium text-recoverpe-black">
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
          <h2 className="text-base font-semibold text-recoverpe-black">
            Document verification
          </h2>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Upload PAN and government ID to activate your field agent profile.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {(["front", "back"] as const).map((side) => {
            const uploaded = Boolean(agent.kyc_documents[side]);

            return (
              <div
                key={side}
                className="rounded-xl border border-recoverpe-grey-light p-4 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-medium capitalize text-recoverpe-black">
                      {side} of Aadhar/PAN
                    </span>
                    <p className="mt-1 text-recoverpe-grey-medium">
                      {uploaded ? "Verified upload on file" : "Required for KYC review"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      uploaded
                        ? "bg-recoverpe-success/10 text-recoverpe-success"
                        : "bg-recoverpe-grey-light text-recoverpe-grey-medium"
                    }`}
                  >
                    {uploaded ? "Uploaded" : "Pending"}
                  </span>
                </div>
                <label className="mt-4 block">
                  <span className="sr-only">Upload {side} document</span>
                  <input
                    className="block w-full text-sm"
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    disabled={uploadingKycSide === side}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      onKycUpload(side, file);
                      event.target.value = "";
                    }}
                  />
                </label>
                {uploadingKycSide === side ? (
                  <p className="mt-2 text-xs text-recoverpe-grey-medium">Uploading…</p>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
