"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { SecureBankLinking } from "@/components/merchant/SecureBankLinking";
import { getAuthHeaders } from "@/lib/auth-headers";
import type { MerchantBankAccountRecord } from "@/lib/payments/merchant-bank-verification";
import { parseApiJsonResponse, readApiJsonBody } from "@/lib/parse-api-response";
import { useWorkspaceStore } from "@/store/workspace-store";

function formatVerifiedAccountLabel(account: MerchantBankAccountRecord): string {
  if (account.upi_vpa) {
    return `UPI · ${account.upi_vpa}`;
  }

  const masked =
    account.account_number && account.account_number.length > 4
      ? `••••${account.account_number.slice(-4)}`
      : "Account";

  return `${masked} · ${account.ifsc ?? "—"}`;
}

export function PayoutDetailsCard() {
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const businesses = useWorkspaceStore((state) => state.businesses);
  const activeBusiness =
    businesses.find((business) => business.id === activeBusinessId) ?? null;

  const [verifiedAccounts, setVerifiedAccounts] = useState<
    MerchantBankAccountRecord[]
  >([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [shopName, setShopName] = useState(activeBusiness?.business_name ?? "");
  const [pan, setPan] = useState(activeBusiness?.payout_pan ?? "");
  const [accountHolderName, setAccountHolderName] = useState(
    activeBusiness?.payout_account_holder_name ?? ""
  );
  const [panVerifiedAt, setPanVerifiedAt] = useState<string | null>(null);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifyingPan, setIsVerifyingPan] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadVerifiedAccounts = useCallback(async () => {
    if (!activeBusinessId) {
      setVerifiedAccounts([]);
      setSelectedAccountId("");
      return;
    }

    setIsLoadingAccounts(true);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `/api/kyc/merchant/verified-accounts?business_id=${encodeURIComponent(activeBusinessId)}`,
        { headers }
      );
      const payload = await parseApiJsonResponse<{ accounts: MerchantBankAccountRecord[] }>(
        response
      );
      setVerifiedAccounts(payload.accounts);
      setSelectedAccountId((current) => {
        if (current && payload.accounts.some((account) => account.id === current)) {
          return current;
        }

        return payload.accounts[0]?.id ?? "";
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load verified settlement accounts."
      );
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [activeBusinessId]);

  useEffect(() => {
    void loadVerifiedAccounts();
  }, [loadVerifiedAccounts]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeBusinessId) {
      setError("Select a business workspace before saving payout details.");
      return;
    }

    if (!selectedAccountId) {
      setError("Verify a settlement account with the ₹5 Secure Bank Linking flow first.");
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
            merchant_bank_account_id: selectedAccountId,
            payout_pan: pan,
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

  const panVerified = Boolean(panVerifiedAt);
  const hasVerifiedAccounts = verifiedAccounts.length > 0;

  return (
    <div className="space-y-6">
      <SecureBankLinking onVerified={() => void loadVerifiedAccounts()} />

      <Card>
        <CardHeader>
          <h2 className="type-section-title">Settlement account</h2>
          <p className="mt-1 text-sm text-recoverpe-muted">
            Settlements can only route to verified accounts captured during Secure
            Bank Linking. Manual bank entry is disabled for compliance.
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

            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-recoverpe-black">
                Verified settlement account
              </span>
              {hasVerifiedAccounts ? (
                <Select
                  className="mt-1"
                  value={selectedAccountId}
                  onChange={(event) => setSelectedAccountId(event.target.value)}
                  required
                >
                  {verifiedAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {formatVerifiedAccountLabel(account)}
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="mt-2 rounded-xl border border-recoverpe-line bg-recoverpe-canvas px-3 py-3 text-sm text-recoverpe-muted">
                  {isLoadingAccounts
                    ? "Loading verified accounts…"
                    : "No verified accounts yet. Complete Secure Bank Linking above."}
                </div>
              )}
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

            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-recoverpe-black">
                Account holder name
              </span>
              <Input
                className="mt-1"
                value={accountHolderName}
                onChange={(event) => setAccountHolderName(event.target.value)}
              />
            </label>

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

            <Button
              type="submit"
              className="sm:col-span-2"
              disabled={isSaving || !hasVerifiedAccounts}
            >
              {isSaving ? "Saving…" : "Save payout details"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
