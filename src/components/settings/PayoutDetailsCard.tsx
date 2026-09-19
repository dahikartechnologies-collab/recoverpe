"use client";

import { FormEvent, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { getAuthHeaders } from "@/lib/auth-headers";
import { parseApiJsonResponse, readApiJsonBody } from "@/lib/parse-api-response";
import { useWorkspaceStore } from "@/store/workspace-store";

export function PayoutDetailsCard() {
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const businesses = useWorkspaceStore((state) => state.businesses);
  const activeBusiness =
    businesses.find((business) => business.id === activeBusinessId) ?? null;

  const [shopName, setShopName] = useState(activeBusiness?.business_name ?? "");
  const [pan, setPan] = useState(activeBusiness?.payout_pan ?? "");
  const [accountNumber, setAccountNumber] = useState(
    activeBusiness?.payout_bank_account_number ?? ""
  );
  const [ifsc, setIfsc] = useState(activeBusiness?.payout_bank_ifsc ?? "");
  const [accountHolderName, setAccountHolderName] = useState(
    activeBusiness?.payout_account_holder_name ?? ""
  );
  const [panVerifiedAt, setPanVerifiedAt] = useState<string | null>(null);
  const [bankVerifiedAt, setBankVerifiedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifyingPan, setIsVerifyingPan] = useState(false);
  const [isVerifyingBank, setIsVerifyingBank] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeBusinessId) {
      setError("Select a business workspace before saving payout details.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `/api/businesses/${activeBusinessId}/payout-setup`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            payout_pan: pan,
            payout_bank_account_number: accountNumber,
            payout_bank_ifsc: ifsc,
            payout_account_holder_name: accountHolderName || shopName,
          }),
        }
      );

      const payload = await parseApiJsonResponse<{ message?: string }>(response);
      setMessage(payload.message ?? "Payout details saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save payout details."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function verifyPan() {
    if (!activeBusinessId) {
      setError("Select a business workspace before verifying PAN.");
      return;
    }

    setIsVerifyingPan(true);
    setError("");
    setMessage("");

    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/kyc/verify-pan", {
        method: "POST",
        headers,
        body: JSON.stringify({
          pan,
          context: "business",
          business_id: activeBusinessId,
        }),
      });
      const body = await readApiJsonBody<{
        pan_verified_at?: string;
        message?: string;
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(body.error || "PAN verification failed.");
      }

      setPanVerifiedAt(body.pan_verified_at ?? new Date().toISOString());
      setMessage(body.message ?? "PAN verified via NSDL.");
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "PAN verification failed."
      );
    } finally {
      setIsVerifyingPan(false);
    }
  }

  async function verifyBank() {
    if (!activeBusinessId) {
      setError("Select a business workspace before verifying bank account.");
      return;
    }

    setIsVerifyingBank(true);
    setError("");
    setMessage("");

    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/kyc/penny-drop", {
        method: "POST",
        headers,
        body: JSON.stringify({
          account_number: accountNumber,
          ifsc,
          account_holder_name: accountHolderName || shopName,
          context: "business",
          business_id: activeBusinessId,
        }),
      });
      const body = await readApiJsonBody<{
        bank_verified_at?: string;
        message?: string;
        error?: string;
      }>(response);

      if (!response.ok) {
        throw new Error(body.error || "Bank verification failed.");
      }

      setBankVerifiedAt(body.bank_verified_at ?? new Date().toISOString());
      setMessage(body.message ?? "Bank account verified.");
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Bank verification failed."
      );
    } finally {
      setIsVerifyingBank(false);
    }
  }

  const panVerified = Boolean(panVerifiedAt);
  const bankVerified = Boolean(bankVerifiedAt);

  return (
    <Card>
      <CardHeader>
        <h2 className="type-section-title">Payout details</h2>
        <p className="mt-1 text-sm text-recoverpe-muted">
          One-time setup so Smart Collect settlements route directly to your bank
          via Razorpay Route. PAN and bank account only — no net-banking login
          required.
        </p>
      </CardHeader>
      <CardContent>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-recoverpe-black">Shop name</span>
            <Input
              className="mt-1"
              value={shopName}
              onChange={(event) => setShopName(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-recoverpe-black">PAN</span>
            <Input
              className="mt-1 uppercase"
              value={pan}
              onChange={(event) => setPan(event.target.value.toUpperCase())}
              required
            />
          </label>
          <div className="flex items-end gap-2">
            <Badge tone={panVerified ? "success" : "neutral"}>
              {panVerified ? "Verified" : "Pending"}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={panVerified || isVerifyingPan || !pan.trim()}
              onClick={() => void verifyPan()}
            >
              {isVerifyingPan ? "Verifying…" : "Verify via NSDL"}
            </Button>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-recoverpe-black">
              Account holder name
            </span>
            <Input
              className="mt-1"
              value={accountHolderName}
              onChange={(event) => setAccountHolderName(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-recoverpe-black">
              Bank account number
            </span>
            <Input
              className="mt-1 font-mono tracking-wide"
              value={accountNumber}
              onChange={(event) => setAccountNumber(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-recoverpe-black">IFSC</span>
            <Input
              className="mt-1 font-mono uppercase tracking-wide"
              value={ifsc}
              onChange={(event) => setIfsc(event.target.value.toUpperCase())}
              required
            />
          </label>
          <div className="flex items-end gap-2 sm:col-span-2">
            <Badge tone={bankVerified ? "success" : "neutral"}>
              {bankVerified ? "Verified" : "Pending verification"}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={
                bankVerified ||
                isVerifyingBank ||
                !accountNumber.trim() ||
                !ifsc.trim()
              }
              onClick={() => void verifyBank()}
            >
              {isVerifyingBank ? "Verifying…" : "Verify Bank"}
            </Button>
          </div>
          {activeBusiness?.razorpay_route_status ? (
            <div className="sm:col-span-2">
              <Badge
                tone={
                  activeBusiness.razorpay_route_status === "active"
                    ? "success"
                    : "neutral"
                }
              >
                Route {activeBusiness.razorpay_route_status}
              </Badge>
            </div>
          ) : null}
          {error ? (
            <Alert tone="danger" className="sm:col-span-2">
              {error}
            </Alert>
          ) : null}
          {message ? (
            <Alert tone="success" className="sm:col-span-2">
              {message}
            </Alert>
          ) : null}
          <Button type="submit" className="sm:col-span-2" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save payout details"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
