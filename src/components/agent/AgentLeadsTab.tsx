"use client";

import { FormEvent, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { AgentCancelReferralModal } from "@/components/agent/AgentCancelReferralModal";
import { AgentEditQuoteModal } from "@/components/agent/AgentEditQuoteModal";
import { AgentLeadCard } from "@/components/agent/AgentLeadCard";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { AgentMeResponse, AgentReferralRecord } from "@/lib/agent-client";
import {
  formatExpectedCashCollection,
  getAgentDiscountOptionsForCap,
} from "@/lib/agent/discounts";
import {
  matchesPipelineFilter,
  PIPELINE_FILTERS,
  type PipelineFilterId,
} from "@/lib/agent/pipeline";

interface AgentLeadsTabProps {
  payload: AgentMeResponse;
  phone: string;
  shop: string;
  discountBps: string;
  isSaving: boolean;
  highlightedReferralId: string | null;
  duplicateOwnedMessage: string;
  duplicateGlobalMessage: string;
  otpByReferralId: Record<string, string>;
  confirmingReferralId: string | null;
  resendingReferralId: string | null;
  editingReferralId: string | null;
  editDiscountBps: string;
  editBusinessName: string;
  savingReferralId: string | null;
  cancellingReferralId: string | null;
  setPhone: (value: string) => void;
  setShop: (value: string) => void;
  setDiscountBps: (value: string) => void;
  setOtpByReferralId: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  setEditingReferralId: (value: string | null) => void;
  setEditDiscountBps: (value: string) => void;
  setEditBusinessName: (value: string) => void;
  setDuplicateGlobalMessage: (value: string) => void;
  referralCardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  onSubmitReferral: (event: FormEvent<HTMLFormElement>) => void;
  onConfirmOtp: (referralId: string) => void;
  onResendOtp: (referralId: string) => void;
  onBeginEditReferral: (referral: AgentReferralRecord) => void;
  onSaveReferralEdit: (referralId: string) => void;
  onCancelReferral: (referralId: string, reason: string) => void;
}

export function AgentLeadsTab({
  payload,
  phone,
  shop,
  discountBps,
  isSaving,
  highlightedReferralId,
  duplicateOwnedMessage,
  duplicateGlobalMessage,
  otpByReferralId,
  confirmingReferralId,
  resendingReferralId,
  editingReferralId,
  editDiscountBps,
  editBusinessName,
  savingReferralId,
  cancellingReferralId,
  setPhone,
  setShop,
  setDiscountBps,
  setOtpByReferralId,
  setEditingReferralId,
  setEditDiscountBps,
  setEditBusinessName,
  setDuplicateGlobalMessage,
  referralCardRefs,
  onSubmitReferral,
  onConfirmOtp,
  onResendOtp,
  onBeginEditReferral,
  onSaveReferralEdit,
  onCancelReferral,
}: AgentLeadsTabProps) {
  const { agent, referrals = [] } = payload;
  const discountOptions = getAgentDiscountOptionsForCap(agent.discount_cap_bps);
  const expectedCollection = formatExpectedCashCollection(Number(discountBps));
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilterId>("all");
  const [cancelReferralId, setCancelReferralId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const filteredReferrals = useMemo(
    () =>
      referrals.filter((referral) =>
        matchesPipelineFilter(referral.status, pipelineFilter)
      ),
    [pipelineFilter, referrals]
  );

  return (
    <div className="space-y-6">
      {duplicateOwnedMessage ? (
        <Alert tone="neutral">{duplicateOwnedMessage}</Alert>
      ) : null}

      {duplicateGlobalMessage ? (
        <Alert
          tone="danger"
          title="This merchant phone is already in another agent's pipeline."
          action={
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setDuplicateGlobalMessage("")}
            >
              Dismiss
            </Button>
          }
        >
          <p>{duplicateGlobalMessage}</p>
          <p className="mt-2">
            Double-check the mobile number or ask the merchant which RecoverPe agent
            is onboarding them.
          </p>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="type-section-title">Refer a merchant</h2>
          <p className="mt-1 text-sm text-recoverpe-muted">
            We WhatsApp a 6-digit OTP to the merchant. Collect the discounted Premium
            cash, then confirm their OTP on the lead card below.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmitReferral}>
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
              <Select
                className="mt-1"
                value={discountBps}
                onChange={(event) => setDiscountBps(event.target.value)}
              >
                {discountOptions.map((option) => (
                  <option key={option.bps} value={option.bps}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
            <div className="rounded-xl border border-recoverpe-line bg-recoverpe-canvas px-3 py-2.5 text-sm sm:col-span-2">
              <span className="text-recoverpe-muted">Collect from merchant: </span>
              <span className="type-data-primary">{expectedCollection}</span>
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

      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="type-section-title">My merchants</h2>
            <p className="mt-1 text-sm text-recoverpe-muted">
              Lead cards for every merchant you referred, with quote and onboarding
              status.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {PIPELINE_FILTERS.map((filter) => {
              const isActive = pipelineFilter === filter.id;

              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setPipelineFilter(filter.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-recoverpe-black bg-recoverpe-black text-recoverpe-white"
                      : "border-recoverpe-line bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-fill"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        {referrals.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users className="h-5 w-5" aria-hidden />}
              title="No leads yet"
              description="Refer a merchant above. Once they confirm the OTP, the lead appears here with remittance status."
            />
          </Card>
        ) : filteredReferrals.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Users className="h-5 w-5" aria-hidden />}
              title="No leads in this pipeline stage"
              description="Try another filter or refer a new merchant to fill your pipeline."
            />
          </Card>
        ) : (
          filteredReferrals.map((referral) => (
            <AgentLeadCard
              key={referral.id}
              referral={referral}
              highlighted={highlightedReferralId === referral.id}
              cardRef={(node) => {
                referralCardRefs.current[referral.id] = node;
              }}
              agentName={agent.display_name}
              referralCode={agent.referral_code}
              otpValue={otpByReferralId[referral.id] ?? ""}
              isConfirming={confirmingReferralId === referral.id}
              isResending={resendingReferralId === referral.id}
              onOtpChange={(value) =>
                setOtpByReferralId((current) => ({
                  ...current,
                  [referral.id]: value,
                }))
              }
              onConfirmOtp={() => void onConfirmOtp(referral.id)}
              onResendOtp={() => void onResendOtp(referral.id)}
              onEditQuote={() => onBeginEditReferral(referral)}
              onCancelReferral={() => {
                setCancelReferralId(referral.id);
                setCancelReason("");
              }}
            />
          ))
        )}
      </div>

      <AgentEditQuoteModal
        isOpen={Boolean(editingReferralId)}
        discountCapBps={agent.discount_cap_bps}
        businessName={editBusinessName}
        discountBps={editDiscountBps}
        isSaving={Boolean(savingReferralId)}
        onBusinessNameChange={setEditBusinessName}
        onDiscountBpsChange={setEditDiscountBps}
        onClose={() => setEditingReferralId(null)}
        onSave={() => {
          if (editingReferralId) {
            void onSaveReferralEdit(editingReferralId);
          }
        }}
      />

      <AgentCancelReferralModal
        isOpen={Boolean(cancelReferralId)}
        reason={cancelReason}
        isSaving={Boolean(cancellingReferralId)}
        onReasonChange={setCancelReason}
        onClose={() => setCancelReferralId(null)}
        onConfirm={() => {
          if (cancelReferralId && cancelReason) {
            void onCancelReferral(cancelReferralId, cancelReason);
            setCancelReferralId(null);
          }
        }}
      />
    </div>
  );
}
