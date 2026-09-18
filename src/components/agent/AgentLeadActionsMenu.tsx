"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  XCircle,
} from "lucide-react";
import type { AgentReferralRecord } from "@/lib/agent-client";
import { buildAgentWhatsAppNudgeUrl } from "@/lib/agent/referral-links";

const EDITABLE_REFERRAL_STATUSES = new Set(["draft", "awaiting_merchant_otp"]);
const RESEND_COOLDOWN_MS = 60_000;

function cooldownStorageKey(referralId: string): string {
  return `recoverpe-agent-otp-cooldown-${referralId}`;
}

function readCooldownRemainingMs(referralId: string): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const raw = window.localStorage.getItem(cooldownStorageKey(referralId));

  if (!raw) {
    return 0;
  }

  const expiresAt = Number.parseInt(raw, 10);

  if (!Number.isFinite(expiresAt)) {
    return 0;
  }

  return Math.max(0, expiresAt - Date.now());
}

interface AgentLeadActionsMenuProps {
  referral: AgentReferralRecord;
  agentName: string;
  referralCode: string;
  isResending: boolean;
  onResendOtp: () => void;
  onEditQuote: () => void;
  onCancelReferral: () => void;
}

export function AgentLeadActionsMenu({
  referral,
  agentName,
  referralCode,
  isResending,
  onResendOtp,
  onEditQuote,
  onCancelReferral,
}: AgentLeadActionsMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    setCooldownSeconds(Math.ceil(readCooldownRemainingMs(referral.id) / 1000));
  }, [referral.id, isResending]);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      const remaining = readCooldownRemainingMs(referral.id);
      setCooldownSeconds(Math.ceil(remaining / 1000));

      if (remaining <= 0) {
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownSeconds, referral.id]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const canEdit = EDITABLE_REFERRAL_STATUSES.has(referral.status);
  const canResend = referral.status === "awaiting_merchant_otp";
  const canCancel = !["activated", "cancelled", "clawback"].includes(referral.status);
  const resendDisabled = isResending || cooldownSeconds > 0;

  function handleResendClick() {
    if (resendDisabled) {
      return;
    }

    window.localStorage.setItem(
      cooldownStorageKey(referral.id),
      String(Date.now() + RESEND_COOLDOWN_MS)
    );
    setCooldownSeconds(RESEND_COOLDOWN_MS / 1000);
    onResendOtp();
    setIsOpen(false);
  }

  function handleWhatsAppNudge() {
    const url = buildAgentWhatsAppNudgeUrl({
      merchantPhone: referral.merchant_phone,
      agentName,
      referralCode,
      businessName: referral.business_name,
    });

    window.open(url, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        aria-label="Lead actions"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-recoverpe-line text-recoverpe-black hover:bg-recoverpe-fill sm:h-9 sm:w-9"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-20 mt-1 min-w-[12.5rem] overflow-hidden rounded-md border border-recoverpe-line bg-recoverpe-white py-1 shadow-sm">
          {canResend ? (
            <button
              type="button"
              disabled={resendDisabled}
              onClick={handleResendClick}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-recoverpe-black hover:bg-recoverpe-fill disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4 shrink-0" />
              {cooldownSeconds > 0
                ? `Resend OTP (${cooldownSeconds}s)`
                : isResending
                  ? "Resending…"
                  : "Resend OTP"}
            </button>
          ) : null}

          {canEdit ? (
            <button
              type="button"
              onClick={() => {
                onEditQuote();
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-recoverpe-black hover:bg-recoverpe-fill"
            >
              <Pencil className="h-4 w-4 shrink-0" />
              Edit quote
            </button>
          ) : null}

          {canCancel ? (
            <button
              type="button"
              onClick={() => {
                onCancelReferral();
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-recoverpe-error hover:bg-recoverpe-fill"
            >
              <XCircle className="h-4 w-4 shrink-0" />
              Cancel referral
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleWhatsAppNudge}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-recoverpe-black hover:bg-recoverpe-fill"
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            Send WhatsApp nudge
          </button>
        </div>
      ) : null}
    </div>
  );
}
