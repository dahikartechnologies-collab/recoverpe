"use client";

import { FormEvent, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import type { AgentMeResponse } from "@/lib/agent-client";
import { getAuthHeaders } from "@/lib/auth-headers";
import { readApiJsonBody } from "@/lib/parse-api-response";
import { ExternalLink, FileCheck2, ShieldCheck } from "lucide-react";

function maskAccountNumber(value: string | null): string {
  if (!value) {
    return "—";
  }

  if (value.length <= 4) {
    return value;
  }

  return `${"•".repeat(Math.max(value.length - 4, 4))}${value.slice(-4)}`;
}

function maskPan(value: string | null): string {
  if (!value) {
    return "Not verified";
  }

  if (value.length <= 4) {
    return value;
  }

  return `${value.slice(0, 5)}••••${value.slice(-1)}`;
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
  onVerificationComplete?: () => void;
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
  onVerificationComplete,
}: AgentKycTabProps) {
  const { agent } = payload;
  const kycDocuments = agent.kyc_documents ?? {};
  const [openingSide, setOpeningSide] = useState<"front" | "back" | null>(null);
  const [panNumber, setPanNumber] = useState(agent.pan_number ?? "");
  const [isVerifyingPan, setIsVerifyingPan] = useState(false);
  const [isVerifyingBank, setIsVerifyingBank] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");

  const panVerified = Boolean(agent.pan_verified_at);
  const bankVerified = Boolean(agent.bank_verified_at);
  const kycVerified = Boolean(agent.kyc_verified_at);
  const hasBankDetails =
    Boolean(bankAccountName.trim()) &&
    Boolean(bankAccountNumber.trim()) &&
    Boolean(bankIfsc.trim());
  const hasAnyKycUpload = Boolean(kycDocuments.front || kycDocuments.back);

  async function openKycDocument(side: "front" | "back") {
    setOpeningSide(side);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `/api/agent/profile/kyc/document?side=${side}`,
        { headers }
      );
      const body = await readApiJsonBody<{ url?: string; error?: string }>(response);

      if (!response.ok || !body.url) {
        throw new Error(body.error || "Failed to open document.");
      }

      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Failed to open uploaded document."
      );
    } finally {
      setOpeningSide(null);
    }
  }

  async function verifyPan() {
    setVerificationError("");
    setVerificationMessage("");
    setIsVerifyingPan(true);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/kyc/verify-pan", {
        method: "POST",
        headers,
        body: JSON.stringify({ pan: panNumber, context: "agent" }),
      });
      const body = await readApiJsonBody<{ message?: string; error?: string }>(
        response
      );

      if (!response.ok) {
        throw new Error(body.error || "PAN verification failed.");
      }

      setVerificationMessage(body.message ?? "PAN verified via NSDL.");
      onVerificationComplete?.();
    } catch (error) {
      setVerificationError(
        error instanceof Error ? error.message : "PAN verification failed."
      );
    } finally {
      setIsVerifyingPan(false);
    }
  }

  async function verifyBank() {
    setVerificationError("");
    setVerificationMessage("");
    setIsVerifyingBank(true);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/kyc/penny-drop", {
        method: "POST",
        headers,
        body: JSON.stringify({
          account_number: bankAccountNumber,
          ifsc: bankIfsc,
          account_holder_name: bankAccountName,
          context: "agent",
        }),
      });
      const body = await readApiJsonBody<{ message?: string; error?: string }>(
        response
      );

      if (!response.ok) {
        throw new Error(body.error || "Bank verification failed.");
      }

      setVerificationMessage(body.message ?? "Bank account verified.");
      onVerificationComplete?.();
    } catch (error) {
      setVerificationError(
        error instanceof Error ? error.message : "Bank verification failed."
      );
    } finally {
      setIsVerifyingBank(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="type-section-title">Verification status</h2>
          <p className="mt-1 text-sm text-recoverpe-muted">
            Compliance checks for PAN and bank account before commission settlement.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-recoverpe-line px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-recoverpe-black">PAN</p>
                <p className="mt-1 font-mono text-sm text-recoverpe-muted">
                  {panVerified ? maskPan(agent.pan_number) : "Not verified"}
                </p>
              </div>
              <Badge tone={panVerified ? "success" : "neutral"}>
                {panVerified ? "Verified" : "Pending"}
              </Badge>
            </div>
          </div>

          <div className="rounded-xl border border-recoverpe-line px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-recoverpe-black">
                  Bank account
                </p>
                <p className="mt-1 font-mono text-sm text-recoverpe-muted">
                  {hasBankDetails
                    ? maskAccountNumber(agent.bank_account_number)
                    : "Not linked"}
                </p>
              </div>
              <Badge tone={bankVerified ? "success" : "neutral"}>
                {bankVerified ? "Verified" : "Pending verification"}
              </Badge>
            </div>
          </div>

          {kycVerified ? (
            <div className="rounded-xl border border-recoverpe-success-line bg-recoverpe-success-fill px-4 py-3 text-sm text-recoverpe-success-ink sm:col-span-2">
              KYC complete — commission withdrawals are enabled.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {verificationError ? (
        <p className="text-sm text-recoverpe-error">{verificationError}</p>
      ) : null}
      {verificationMessage ? (
        <p className="text-sm text-recoverpe-success-ink">{verificationMessage}</p>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="type-section-title">PAN verification</h2>
          <p className="mt-1 text-sm text-recoverpe-muted">
            Verify your PAN against NSDL before commission settlement.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm">
            <span className="font-medium text-recoverpe-black">PAN number</span>
            <Input
              className="mt-1 uppercase"
              value={panNumber}
              onChange={(event) => setPanNumber(event.target.value.toUpperCase())}
              disabled={panVerified}
              required
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={panVerified || isVerifyingPan || !panNumber.trim()}
            onClick={() => void verifyPan()}
          >
            {isVerifyingPan ? "Verifying…" : "Verify via NSDL"}
          </Button>
        </CardContent>
      </Card>

      {!hasBankDetails ? (
        <Card>
          <EmptyState
            icon={<FileCheck2 className="h-5 w-5" aria-hidden />}
            title="Add payout bank details"
            description="Save your account holder name, account number, and IFSC so commissions can settle after merchant onboardings close."
          />
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="type-section-title">Bank account & payout details</h2>
          <p className="mt-1 text-sm text-recoverpe-muted">
            Commissions settle to this bank account via Razorpay Payouts.
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
            <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? "Saving…" : "Save bank details"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={bankVerified || isVerifyingBank || !hasBankDetails}
                onClick={() => void verifyBank()}
              >
                {isVerifyingBank ? "Verifying…" : "Verify Bank"}
              </Button>
            </div>
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
            const uploaded = Boolean(kycDocuments[side]);

            return (
              <div
                key={side}
                className="rounded-xl border border-dashed border-recoverpe-line-strong bg-recoverpe-canvas p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-medium capitalize text-recoverpe-black">
                      {side} of Aadhar/PAN
                    </span>
                    <p className="mt-1 text-sm text-recoverpe-muted">
                      {uploaded
                        ? "Document on file"
                        : "JPG, PNG, or PDF · max 4MB"}
                    </p>
                  </div>
                  <Badge tone={uploaded ? "success" : "neutral"}>
                    {uploaded ? "Uploaded" : "Pending"}
                  </Badge>
                </div>

                {uploaded ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex h-24 items-center justify-center rounded-lg border border-recoverpe-line bg-recoverpe-white">
                      <div className="text-center">
                        <ShieldCheck
                          className="mx-auto h-5 w-5 text-recoverpe-success-ink"
                          aria-hidden
                        />
                        <p className="mt-2 font-mono text-xs text-recoverpe-muted">
                          {side === "front" ? "PAN ••••" : "ID ••••"}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={openingSide === side}
                      onClick={() => void openKycDocument(side)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {openingSide === side ? "Opening…" : "View uploaded ID"}
                    </Button>
                  </div>
                ) : (
                  <label className="rp-interactive mt-4 block cursor-pointer text-sm font-medium text-recoverpe-black hover:underline">
                    Choose file
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
                    {uploadingKycSide === side ? (
                      <span className="ml-2 text-recoverpe-muted">Uploading…</span>
                    ) : null}
                  </label>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {!hasAnyKycUpload ? (
        <Card>
          <EmptyState
            icon={<FileCheck2 className="h-5 w-5" aria-hidden />}
            title="No KYC documents uploaded"
            description="Upload the front and back of your government ID to complete field agent verification."
          />
        </Card>
      ) : null}
    </div>
  );
}
