"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { DashboardLogoutButton } from "@/components/dashboard/DashboardLogoutButton";
import {
  formatExpectedCashCollection,
  getAgentDiscountOptionsForCap,
  referralStatusLabel,
} from "@/lib/agent/discounts";
import { getAuthHeaders } from "@/lib/auth-headers";
import { persistActiveContext } from "@/lib/post-auth-navigation";
import { parseApiJsonResponse } from "@/lib/parse-api-response";

interface AgentMeResponse {
  agent: {
    display_name: string;
    status: string;
    referral_code: string;
    discount_cap_bps: number;
    wallet_liability_inr: number;
    open_cash_tickets: number;
    referrals_frozen: boolean;
  };
  referrals: Array<{
    id: string;
    merchant_phone: string;
    business_name: string | null;
    discount_bps: number;
    status: string;
    created_at: string;
  }>;
}

const selectClassName =
  "w-full rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2 text-sm text-recoverpe-black";

export default function AgentDashboardPage() {
  const router = useRouter();
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

  async function load() {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/agent/me", { headers });
    setPayload(await parseApiJsonResponse<AgentMeResponse>(response));
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

  const { agent, referrals } = payload;

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
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Cash liability
            </p>
            <p className="mt-1 text-xl font-semibold text-recoverpe-black">
              ₹{agent.wallet_liability_inr.toLocaleString("en-IN")}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-recoverpe-grey-medium">
              Open tickets
            </p>
            <p className="mt-1 text-xl font-semibold text-recoverpe-black">
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
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-recoverpe-error">{error}</p>
      ) : null}

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
            Referrals
          </h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {referrals.length === 0 ? (
            <p className="text-sm text-recoverpe-grey-medium">
              No referrals yet.
            </p>
          ) : (
            referrals.map((referral) => (
              <div
                key={referral.id}
                className="space-y-3 border border-recoverpe-grey-light px-3 py-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-recoverpe-black">
                      {referral.business_name || referral.merchant_phone}
                    </p>
                    <p className="text-recoverpe-grey-medium">
                      {referral.merchant_phone} ·{" "}
                      {referralStatusLabel(referral.status)}
                    </p>
                  </div>
                  <div className="text-right text-recoverpe-grey-medium">
                    <p>{referral.discount_bps / 100}% off</p>
                    <p className="mt-1 font-medium text-recoverpe-black">
                      {formatExpectedCashCollection(referral.discount_bps)}
                    </p>
                  </div>
                </div>

                {referral.status === "awaiting_merchant_otp" ? (
                  <div className="flex flex-col gap-2 border-t border-recoverpe-grey-light pt-3 sm:flex-row sm:items-end">
                    <label className="block flex-1 text-sm">
                      <span className="font-medium text-recoverpe-black">
                        Merchant OTP
                      </span>
                      <Input
                        className="mt-1"
                        inputMode="numeric"
                        pattern="\d{6}"
                        maxLength={6}
                        placeholder="6-digit code"
                        value={otpByReferralId[referral.id] ?? ""}
                        onChange={(event) =>
                          setOtpByReferralId((current) => ({
                            ...current,
                            [referral.id]: event.target.value.replace(/\D/g, "").slice(0, 6),
                          }))
                        }
                      />
                    </label>
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
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
