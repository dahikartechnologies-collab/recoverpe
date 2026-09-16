"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { DashboardLogoutButton } from "@/components/dashboard/DashboardLogoutButton";
import {
  fetchAgentMe,
  patchAgentBankProfile,
  patchAgentReferral,
  uploadAgentKycDocument,
  type AgentMeResponse,
  type AgentReferralRecord,
} from "@/lib/agent-client";
import {
  formatExpectedCashCollection,
  getAgentDiscountOptionsForCap,
  referralStatusLabel,
} from "@/lib/agent/discounts";
import { getAuthHeaders } from "@/lib/auth-headers";
import { persistActiveContext } from "@/lib/post-auth-navigation";
import { parseApiJsonResponse } from "@/lib/parse-api-response";

type AgentTab = "crm" | "profile";

const selectClassName =
  "w-full rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2 text-sm text-recoverpe-black";

const EDITABLE_REFERRAL_STATUSES = new Set(["draft", "awaiting_merchant_otp"]);

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

function maskAccountNumber(value: string | null): string {
  if (!value) {
    return "—";
  }

  if (value.length <= 4) {
    return value;
  }

  return `${"•".repeat(Math.max(value.length - 4, 4))}${value.slice(-4)}`;
}

export function AgentDashboardView() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AgentTab>("crm");
  const [payload, setPayload] = useState<AgentMeResponse | null>(null);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [shop, setShop] = useState("");
  const [discountBps, setDiscountBps] = useState("0");
  const [isSaving, setIsSaving] = useState(false);
  const [otpByReferralId, setOtpByReferralId] = useState<Record<string, string>>(
    {}
  );
  const [confirmingReferralId, setConfirmingReferralId] = useState<string | null>(
    null
  );
  const [editingReferralId, setEditingReferralId] = useState<string | null>(null);
  const [editDiscountBps, setEditDiscountBps] = useState("0");
  const [editBusinessName, setEditBusinessName] = useState("");
  const [savingReferralId, setSavingReferralId] = useState<string | null>(null);
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [uploadingKycSide, setUploadingKycSide] = useState<"front" | "back" | null>(
    null
  );

  async function load() {
    const next = await fetchAgentMe();
    setPayload(next);
    setBankAccountName(next.agent.bank_account_name ?? "");
    setBankAccountNumber(next.agent.bank_account_number ?? "");
    setBankIfsc(next.agent.bank_ifsc ?? "");
  }

  useEffect(() => {
    void load().catch((loadError: unknown) => {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load agent desk."
      );
    });
  }, []);

  const discountOptions = useMemo(
    () =>
      payload
        ? getAgentDiscountOptionsForCap(payload.agent.discount_cap_bps)
        : getAgentDiscountOptionsForCap(1200),
    [payload]
  );

  const expectedCollection = useMemo(
    () => formatExpectedCashCollection(Number(discountBps)),
    [discountBps]
  );

  useEffect(() => {
    if (discountOptions.length === 0) {
      return;
    }

    if (!discountOptions.some((option) => String(option.bps) === discountBps)) {
      setDiscountBps(String(discountOptions[0].bps));
    }
  }, [discountBps, discountOptions]);

  async function handleReferral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/agent/referrals", {
        method: "POST",
        headers,
        body: JSON.stringify({
          merchant_phone: phone,
          business_name: shop,
          discount_bps: Number(discountBps),
        }),
      });
      await parseApiJsonResponse(response);
      setPhone("");
      setShop("");
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to create referral."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmOtp(referralId: string) {
    const otp = otpByReferralId[referralId]?.trim() ?? "";

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit OTP the merchant received on WhatsApp.");
      return;
    }

    setError("");
    setConfirmingReferralId(referralId);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/agent/referrals/${referralId}/confirm-otp`, {
        method: "POST",
        headers,
        body: JSON.stringify({ otp }),
      });
      await parseApiJsonResponse(response);
      setOtpByReferralId((current) => {
        const next = { ...current };
        delete next[referralId];
        return next;
      });
      await load();
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "Failed to confirm merchant OTP."
      );
    } finally {
      setConfirmingReferralId(null);
    }
  }

  function beginEditReferral(referral: AgentReferralRecord) {
    setEditingReferralId(referral.id);
    setEditDiscountBps(String(referral.discount_bps));
    setEditBusinessName(referral.business_name ?? "");
    setError("");
  }

  async function handleSaveReferralEdit(referralId: string) {
    setError("");
    setSavingReferralId(referralId);

    try {
      await patchAgentReferral(referralId, {
        discount_bps: Number(editDiscountBps),
        business_name: editBusinessName.trim() || null,
      });
      setEditingReferralId(null);
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to update referral."
      );
    } finally {
      setSavingReferralId(null);
    }
  }

  async function handleSaveBankProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSavingProfile(true);

    try {
      await patchAgentBankProfile({
        bank_account_name: bankAccountName,
        bank_account_number: bankAccountNumber,
        bank_ifsc: bankIfsc,
      });
      await load();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Failed to save bank details."
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleKycUpload(side: "front" | "back", file: File | null) {
    if (!file) {
      return;
    }

    setError("");
    setUploadingKycSide(side);

    try {
      await uploadAgentKycDocument({ side, file });
      await load();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to upload KYC document."
      );
    } finally {
      setUploadingKycSide(null);
    }
  }

  async function switchToMerchant() {
    await persistActiveContext("merchant");
    router.push("/dashboard");
  }

  if (!payload) {
    return (
      <p className="text-sm text-recoverpe-grey-medium">
        {error || "Loading agent desk…"}
      </p>
    );
  }

  const { agent, analytics, referrals } = payload;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="type-eyebrow">Field agent</p>
          <h1 className="type-page-title mt-2">{agent.display_name}</h1>
          <p className="mt-2 text-sm text-recoverpe-grey-medium">
            Code {agent.referral_code} · cap {agent.discount_cap_bps / 100}% ·
            status {agent.status}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button variant="secondary" onClick={() => void switchToMerchant()}>
            Open merchant shop
          </Button>
          <DashboardLogoutButton />
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Leads generated
            </p>
            <p className="mt-1 text-xl font-semibold text-recoverpe-black">
              {analytics.leads_generated}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Sales closed
            </p>
            <p className="mt-1 text-xl font-semibold text-recoverpe-black">
              {analytics.sales_closed}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Total earnings
            </p>
            <p className="mt-1 text-xl font-semibold text-recoverpe-success">
              {formatInr(analytics.total_earnings_inr)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Pending remittance
            </p>
            <p className="mt-1 text-xl font-semibold text-recoverpe-black">
              {formatInr(analytics.pending_remittance_inr)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Open tickets
            </p>
            <p className="mt-1 text-lg font-semibold text-recoverpe-black">
              {agent.open_cash_tickets} / 5
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              New referrals
            </p>
            <p className="mt-1 text-sm font-medium text-recoverpe-black">
              {agent.referrals_frozen ? "Frozen until remittance" : "Open"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              KYC status
            </p>
            <p className="mt-1 text-sm font-medium text-recoverpe-black">
              {agent.kyc_documents.front && agent.kyc_documents.back
                ? "Documents uploaded"
                : "Upload Aadhar/PAN front and back"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 border-b border-recoverpe-grey-light">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "crm"
              ? "border-b-2 border-recoverpe-black text-recoverpe-black"
              : "text-recoverpe-grey-medium"
          }`}
          onClick={() => setActiveTab("crm")}
        >
          My merchants
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "profile"
              ? "border-b-2 border-recoverpe-black text-recoverpe-black"
              : "text-recoverpe-grey-medium"
          }`}
          onClick={() => setActiveTab("profile")}
        >
          Profile & KYC
        </button>
      </div>

      {error ? (
        <p className="text-sm text-recoverpe-error">{error}</p>
      ) : null}

      {activeTab === "crm" ? (
        <>
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-recoverpe-black">
                Refer a merchant
              </h2>
              <p className="mt-1 text-sm text-recoverpe-grey-medium">
                We WhatsApp a 6-digit OTP to the merchant. Collect the discounted
                Premium cash, then enter their OTP below to open the remittance ticket.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleReferral}>
                <Input
                  placeholder="Merchant mobile"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required
                />
                <Input
                  placeholder="Shop name"
                  value={shop}
                  onChange={(event) => setShop(event.target.value)}
                />
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium text-recoverpe-black">
                    Discount (Premium list ₹1,999/mo)
                  </span>
                  <select
                    className={`${selectClassName} mt-1`}
                    value={discountBps}
                    onChange={(event) => setDiscountBps(event.target.value)}
                  >
                    {discountOptions.map((option) => (
                      <option key={option.bps} value={option.bps}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-md border border-recoverpe-grey-light px-3 py-2 text-sm sm:col-span-2">
                  <span className="text-recoverpe-grey-medium">Collect from merchant: </span>
                  <span className="font-semibold text-recoverpe-black">
                    {expectedCollection}
                  </span>
                </div>
                <Button
                  type="submit"
                  className="sm:col-span-2"
                  disabled={isSaving || agent.referrals_frozen}
                >
                  {isSaving ? "Sending OTP…" : "Send merchant OTP"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold text-recoverpe-black">
                My merchants
              </h2>
              <p className="mt-1 text-sm text-recoverpe-grey-medium">
                Every merchant phone you submitted, with quote status and editable
                discounts while OTP is still pending.
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {referrals.length === 0 ? (
                <p className="text-sm text-recoverpe-grey-medium">
                  No referrals yet.
                </p>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-recoverpe-grey-light text-recoverpe-grey-medium">
                      <th className="px-3 py-2 font-medium">Phone</th>
                      <th className="px-3 py-2 font-medium">Business</th>
                      <th className="px-3 py-2 font-medium">Discount</th>
                      <th className="px-3 py-2 font-medium">Collect</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((referral) => {
                      const isEditing = editingReferralId === referral.id;
                      const canEdit = EDITABLE_REFERRAL_STATUSES.has(referral.status);

                      return (
                        <tr
                          key={referral.id}
                          className="border-b border-recoverpe-grey-light align-top"
                        >
                          <td className="px-3 py-3 font-medium text-recoverpe-black">
                            {referral.merchant_phone}
                          </td>
                          <td className="px-3 py-3">
                            {isEditing ? (
                              <Input
                                value={editBusinessName}
                                onChange={(event) =>
                                  setEditBusinessName(event.target.value)
                                }
                                placeholder="Shop name"
                              />
                            ) : (
                              referral.business_name || "—"
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {isEditing ? (
                              <select
                                className={selectClassName}
                                value={editDiscountBps}
                                onChange={(event) =>
                                  setEditDiscountBps(event.target.value)
                                }
                              >
                                {discountOptions.map((option) => (
                                  <option key={option.bps} value={option.bps}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              `${referral.discount_bps / 100}%`
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {formatExpectedCashCollection(referral.discount_bps)}
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-mono text-xs text-recoverpe-black">
                              {referral.status}
                            </span>
                            <p className="mt-1 text-xs text-recoverpe-grey-medium">
                              {referralStatusLabel(referral.status)}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            {isEditing ? (
                              <div className="flex flex-col gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  disabled={savingReferralId === referral.id}
                                  onClick={() => void handleSaveReferralEdit(referral.id)}
                                >
                                  {savingReferralId === referral.id
                                    ? "Saving…"
                                    : "Save quote"}
                                </Button>
                                <button
                                  type="button"
                                  className="text-left text-xs text-recoverpe-grey-medium"
                                  onClick={() => setEditingReferralId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                {canEdit ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => beginEditReferral(referral)}
                                  >
                                    Edit quote
                                  </Button>
                                ) : null}
                                {referral.status === "awaiting_merchant_otp" ? (
                                  <>
                                    <Input
                                      inputMode="numeric"
                                      pattern="\d{6}"
                                      maxLength={6}
                                      placeholder="OTP"
                                      value={otpByReferralId[referral.id] ?? ""}
                                      onChange={(event) =>
                                        setOtpByReferralId((current) => ({
                                          ...current,
                                          [referral.id]: event.target.value
                                            .replace(/\D/g, "")
                                            .slice(0, 6),
                                        }))
                                      }
                                    />
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      disabled={confirmingReferralId === referral.id}
                                      onClick={() => void handleConfirmOtp(referral.id)}
                                    >
                                      {confirmingReferralId === referral.id
                                        ? "Confirming…"
                                        : "Confirm OTP"}
                                    </Button>
                                  </>
                                ) : !canEdit ? (
                                  <span className="text-recoverpe-grey-medium">—</span>
                                ) : null}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-recoverpe-black">
              Profile & payout details
            </h2>
            <p className="mt-1 text-sm text-recoverpe-grey-medium">
              Bank details for commission payouts and KYC documents for verification.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSaveBankProfile}>
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
                <span className="font-medium text-recoverpe-black">
                  Account number
                </span>
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

            <div className="grid gap-4 sm:grid-cols-2">
              {(["front", "back"] as const).map((side) => {
                const uploaded = Boolean(agent.kyc_documents[side]);

                return (
                  <label
                    key={side}
                    className="block rounded-md border border-recoverpe-grey-light p-4 text-sm"
                  >
                    <span className="font-medium capitalize text-recoverpe-black">
                      {side} of Aadhar/PAN
                    </span>
                    <p className="mt-1 text-recoverpe-grey-medium">
                      {uploaded ? "Uploaded" : "JPG, PNG, or PDF up to 4MB"}
                    </p>
                    <input
                      className="mt-3 block w-full text-sm"
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      disabled={uploadingKycSide === side}
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        void handleKycUpload(side, file);
                        event.target.value = "";
                      }}
                    />
                    {uploadingKycSide === side ? (
                      <p className="mt-2 text-xs text-recoverpe-grey-medium">
                        Uploading…
                      </p>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
