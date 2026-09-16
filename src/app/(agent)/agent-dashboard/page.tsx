"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { DashboardLogoutButton } from "@/components/dashboard/DashboardLogoutButton";
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

export default function AgentDashboardPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<AgentMeResponse | null>(null);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [shop, setShop] = useState("");
  const [discountBps, setDiscountBps] = useState("0");
  const [isSaving, setIsSaving] = useState(false);

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
            OTP goes to their WhatsApp. Premium activates when they reply — you
            cannot punch it in from this phone. ₹100 accrues after remittance.
          </p>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-3" onSubmit={handleReferral}>
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
            <Input
              placeholder="Discount bps (max 1200)"
              value={discountBps}
              onChange={(event) => setDiscountBps(event.target.value)}
            />
            <Button
              type="submit"
              className="sm:col-span-3"
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
                className="flex items-center justify-between border border-recoverpe-grey-light px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-recoverpe-black">
                    {referral.business_name || referral.merchant_phone}
                  </p>
                  <p className="text-recoverpe-grey-medium">
                    {referral.merchant_phone} · {referral.status}
                  </p>
                </div>
                <p className="text-recoverpe-grey-medium">
                  {referral.discount_bps / 100}% off
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
