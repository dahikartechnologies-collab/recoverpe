"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AgentKycTab } from "@/components/agent/AgentKycTab";
import { AgentLeadsTab } from "@/components/agent/AgentLeadsTab";
import { AgentPerformanceTab } from "@/components/agent/AgentPerformanceTab";
import { Button } from "@/components/ui/Button";
import { DashboardLogoutButton } from "@/components/dashboard/DashboardLogoutButton";
import {
  createAgentReferral,
  fetchAgentMe,
  patchAgentBankProfile,
  patchAgentReferral,
  resendAgentReferralOtp,
  uploadAgentKycDocument,
  type AgentMeResponse,
  type AgentReferralRecord,
} from "@/lib/agent-client";
import { getAgentDiscountOptionsForCap } from "@/lib/agent/discounts";
import { parseAgentTab, type AgentTab } from "@/lib/agent/tab-state";
import { getAuthHeaders } from "@/lib/auth-headers";
import { persistActiveContext } from "@/lib/post-auth-navigation";
import { parseApiJsonResponse } from "@/lib/parse-api-response";

export function AgentDashboardView() {
  const router = useRouter();
  const referralCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [activeTab, setActiveTab] = useState<AgentTab>("performance");
  const [payload, setPayload] = useState<AgentMeResponse | null>(null);
  const [error, setError] = useState("");
  const [duplicateOwnedMessage, setDuplicateOwnedMessage] = useState("");
  const [duplicateGlobalMessage, setDuplicateGlobalMessage] = useState("");
  const [highlightedReferralId, setHighlightedReferralId] = useState<string | null>(
    null
  );
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
  const [resendingReferralId, setResendingReferralId] = useState<string | null>(
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

  useEffect(() => {
    function syncTabFromHash() {
      const hash = window.location.hash.replace("#", "");
      const nextTab = parseAgentTab(hash || "performance");
      setActiveTab(nextTab);
    }

    if (!window.location.hash) {
      window.location.replace(`${window.location.pathname}#performance`);
    }

    syncTabFromHash();
    window.addEventListener("hashchange", syncTabFromHash);

    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, []);

  useEffect(() => {
    if (!highlightedReferralId) {
      return;
    }

    const node = referralCardRefs.current[highlightedReferralId];

    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightedReferralId, payload?.referrals]);

  const discountOptions = useMemo(
    () =>
      payload
        ? getAgentDiscountOptionsForCap(payload.agent.discount_cap_bps)
        : getAgentDiscountOptionsForCap(1200),
    [payload]
  );

  useEffect(() => {
    if (discountOptions.length === 0) {
      return;
    }

    if (!discountOptions.some((option) => String(option.bps) === discountBps)) {
      setDiscountBps(String(discountOptions[0].bps));
    }
  }, [discountBps, discountOptions]);

  function focusExistingReferral(referralId: string) {
    setActiveTab("leads");
    window.location.hash = "leads";
    setHighlightedReferralId(referralId);
    setDuplicateOwnedMessage("Merchant already exists in your pipeline.");
    window.setTimeout(() => setHighlightedReferralId(null), 6000);
  }

  async function handleReferral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setDuplicateOwnedMessage("");
    setDuplicateGlobalMessage("");
    setIsSaving(true);

    try {
      const result = await createAgentReferral({
        merchant_phone: phone,
        business_name: shop,
        discount_bps: Number(discountBps),
      });

      if ("error" in result && result.error === "DUPLICATE_OWNED") {
        await load();
        focusExistingReferral(result.referralId);
        return;
      }

      if ("error" in result && result.error === "DUPLICATE_GLOBAL") {
        setDuplicateGlobalMessage(result.message);
        return;
      }

      if ("ok" in result && result.ok === false) {
        setError(result.message);
        return;
      }

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

  async function handleResendOtp(referralId: string) {
    setError("");
    setResendingReferralId(referralId);

    try {
      await resendAgentReferralOtp(referralId);
      await load();
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : "Failed to resend merchant OTP."
      );
    } finally {
      setResendingReferralId(null);
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

  const { agent } = payload;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="type-eyebrow">Field agent</p>
          <h1 className="type-page-title mt-2">{agent.display_name}</h1>
          <p className="mt-2 text-sm text-recoverpe-grey-medium">
            Code {agent.referral_code} · cap {agent.discount_cap_bps / 100}% ·
            status {agent.status}
            {agent.referrals_frozen ? " · referrals frozen" : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button variant="secondary" onClick={() => void switchToMerchant()}>
            Open merchant shop
          </Button>
          <DashboardLogoutButton />
        </div>
      </div>

      {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

      {activeTab === "performance" ? <AgentPerformanceTab payload={payload} /> : null}

      {activeTab === "leads" ? (
        <AgentLeadsTab
          payload={payload}
          phone={phone}
          shop={shop}
          discountBps={discountBps}
          isSaving={isSaving}
          highlightedReferralId={highlightedReferralId}
          duplicateOwnedMessage={duplicateOwnedMessage}
          duplicateGlobalMessage={duplicateGlobalMessage}
          otpByReferralId={otpByReferralId}
          confirmingReferralId={confirmingReferralId}
          resendingReferralId={resendingReferralId}
          editingReferralId={editingReferralId}
          editDiscountBps={editDiscountBps}
          editBusinessName={editBusinessName}
          savingReferralId={savingReferralId}
          setPhone={setPhone}
          setShop={setShop}
          setDiscountBps={setDiscountBps}
          setOtpByReferralId={setOtpByReferralId}
          setEditingReferralId={setEditingReferralId}
          setEditDiscountBps={setEditDiscountBps}
          setEditBusinessName={setEditBusinessName}
          setDuplicateGlobalMessage={setDuplicateGlobalMessage}
          referralCardRefs={referralCardRefs}
          onSubmitReferral={handleReferral}
          onConfirmOtp={handleConfirmOtp}
          onResendOtp={handleResendOtp}
          onBeginEditReferral={beginEditReferral}
          onSaveReferralEdit={handleSaveReferralEdit}
        />
      ) : null}

      {activeTab === "kyc" ? (
        <AgentKycTab
          payload={payload}
          bankAccountName={bankAccountName}
          bankAccountNumber={bankAccountNumber}
          bankIfsc={bankIfsc}
          isSavingProfile={isSavingProfile}
          uploadingKycSide={uploadingKycSide}
          setBankAccountName={setBankAccountName}
          setBankAccountNumber={setBankAccountNumber}
          setBankIfsc={setBankIfsc}
          onSaveBankProfile={handleSaveBankProfile}
          onKycUpload={handleKycUpload}
        />
      ) : null}
    </div>
  );
}
