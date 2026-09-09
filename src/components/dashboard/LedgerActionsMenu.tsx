"use client";

import { useEffect, useRef, useState } from "react";
import {
  canInitiateAiCallForLedger,
  canRectifyLedger,
  getDisplayLedgerStatus,
} from "@/lib/ledger-status";
import { LedgerWithContact } from "@/types";

interface LedgerActionsMenuProps {
  ledger: LedgerWithContact;
  readOnly?: boolean;
  canSendReminders?: boolean;
  canSpendFunds?: boolean;
  canViewEvidenceDocket?: boolean;
  onViewPdf: (ledger: LedgerWithContact) => void;
  onSendReminder: (ledger: LedgerWithContact) => void;
  onSendFromPhone: (ledger: LedgerWithContact) => void;
  onLogOfflinePayment: (ledger: LedgerWithContact) => void;
  onRectifyLedger?: (ledger: LedgerWithContact) => void;
  onInitiateAiCall: (ledger: LedgerWithContact) => void;
  onIssueLegalNotice?: (ledger: LedgerWithContact) => void;
  onFileSamadhaan?: (ledger: LedgerWithContact) => void;
  onDownloadLegalNotice?: (ledger: LedgerWithContact) => void;
  onViewSamadhaanDocket?: (ledger: LedgerWithContact) => void;
  onViewEvidenceDocket?: (ledger: LedgerWithContact) => void;
  onToggleAutomationPause: (
    ledger: LedgerWithContact,
    communicationPaused: boolean
  ) => void;
  isSending?: boolean;
  isCalling?: boolean;
  isToggling?: boolean;
  isMicroProcessing?: boolean;
  isDownloadingLegalNotice?: boolean;
  isViewingSamadhaan?: boolean;
  isDownloadingEvidenceDocket?: boolean;
}

interface MenuItem {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  dividerBefore?: boolean;
}

function canSendReminder(ledger: LedgerWithContact): boolean {
  return (
    ledger.balance_due > 0 &&
    !["paid", "cancelled", "refunded"].includes(ledger.status) &&
    !ledger.communication_paused
  );
}

function canLogOfflinePayment(ledger: LedgerWithContact): boolean {
  return ledger.balance_due > 0 && ledger.status !== "cancelled";
}

function canSendFromPhone(ledger: LedgerWithContact): boolean {
  return (
    ledger.balance_due > 0 &&
    !["paid", "cancelled", "refunded"].includes(ledger.status)
  );
}

export function LedgerActionsMenu({
  ledger,
  readOnly = false,
  canSendReminders = true,
  canSpendFunds = false,
  onViewPdf,
  onSendReminder,
  onSendFromPhone,
  onLogOfflinePayment,
  onRectifyLedger,
  onInitiateAiCall,
  onIssueLegalNotice,
  onFileSamadhaan,
  onDownloadLegalNotice,
  onViewSamadhaanDocket,
  onViewEvidenceDocket,
  onToggleAutomationPause,
  canViewEvidenceDocket = false,
  isSending = false,
  isCalling = false,
  isToggling = false,
  isMicroProcessing = false,
  isDownloadingLegalNotice = false,
  isViewingSamadhaan = false,
  isDownloadingEvidenceDocket = false,
}: LedgerActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const reminderEnabled = canSendReminder(ledger);
  const sendFromPhoneEnabled = canSendFromPhone(ledger);
  const offlinePaymentEnabled = canLogOfflinePayment(ledger);
  const aiCallEnabled = canInitiateAiCallForLedger(ledger);
  const rectifyEnabled = canRectifyLedger(ledger);
  const microActionsEnabled =
    ledger.balance_due > 0 && ledger.status !== "cancelled";
  const hasLegalNotice = Boolean(ledger.legal_notice_pdf_url);
  const hasSamadhaanDocket = Boolean(ledger.samadhaan_docket_pdf_url);
  const automationsPaused = ledger.communication_paused;
  const displayStatus = getDisplayLedgerStatus(ledger);
  const hasAnyAction =
    Boolean(ledger.pdf_url) ||
    hasLegalNotice ||
    hasSamadhaanDocket ||
    reminderEnabled ||
    sendFromPhoneEnabled ||
    aiCallEnabled ||
    offlinePaymentEnabled ||
    rectifyEnabled ||
    microActionsEnabled ||
    canViewEvidenceDocket ||
    displayStatus !== "cancelled";

  const items: MenuItem[] = [];

  if (ledger.pdf_url) {
    items.push({
      key: "view-pdf",
      label: "View / Download PDF",
      onClick: () => onViewPdf(ledger),
    });
  }

  if (reminderEnabled && !readOnly && canSendReminders) {
    items.push({
      key: "send-reminder",
      label: isSending ? "Sending WhatsApp..." : "Send WhatsApp Reminder",
      onClick: () => onSendReminder(ledger),
      disabled: isSending,
    });
  }

  if (sendFromPhoneEnabled && !readOnly && canSendReminders) {
    items.push({
      key: "send-phone",
      label: "Send from my Phone",
      onClick: () => onSendFromPhone(ledger),
    });
  }

  if (aiCallEnabled && !readOnly) {
    items.push({
      key: "ai-call",
      label: isCalling ? "Initiating AI Call..." : "Initiate AI Call",
      onClick: () => onInitiateAiCall(ledger),
      disabled: isCalling,
    });
  }

  if (offlinePaymentEnabled && !readOnly) {
    items.push({
      key: "offline-payment",
      label: "Log Offline Payment",
      onClick: () => onLogOfflinePayment(ledger),
    });
  }

  if (rectifyEnabled && onRectifyLedger && !readOnly) {
    items.push({
      key: "rectify",
      label: "Edit / Rectify Ledger",
      onClick: () => onRectifyLedger(ledger),
    });
  }

  if (displayStatus !== "cancelled" && !readOnly) {
    items.push({
      key: "toggle-automation",
      label: isToggling
        ? "Updating automations..."
        : automationsPaused
          ? "Resume Automations"
          : "Pause Automations",
      onClick: () => onToggleAutomationPause(ledger, !automationsPaused),
      disabled: isToggling,
    });
  }

  if (canViewEvidenceDocket && onViewEvidenceDocket) {
    items.push({
      key: "view-evidence-docket",
      label: isDownloadingEvidenceDocket
        ? "Opening..."
        : "View Evidence Docket",
      onClick: () => onViewEvidenceDocket(ledger),
      disabled: isDownloadingEvidenceDocket,
      dividerBefore: items.length > 0,
    });
  }

  if (hasLegalNotice && onDownloadLegalNotice) {
    items.push({
      key: "download-legal-notice",
      label: isDownloadingLegalNotice
        ? "Downloading..."
        : "📄 Download Legal Notice",
      onClick: () => onDownloadLegalNotice(ledger),
      disabled: isDownloadingLegalNotice,
      dividerBefore: true,
    });
  } else if (microActionsEnabled && onIssueLegalNotice && !readOnly && canSpendFunds) {
    items.push({
      key: "legal-notice",
      label: isMicroProcessing
        ? "Processing..."
        : "Issue Formal Legal Notice (₹999)",
      onClick: () => onIssueLegalNotice(ledger),
      disabled: isMicroProcessing,
      dividerBefore: true,
    });
  }

  if (hasSamadhaanDocket && onViewSamadhaanDocket && canViewEvidenceDocket) {
    items.push({
      key: "view-samadhaan",
      label: isViewingSamadhaan ? "Opening..." : "View Samadhaan Kit",
      onClick: () => onViewSamadhaanDocket(ledger),
      disabled: isViewingSamadhaan,
      dividerBefore: !hasLegalNotice && !onIssueLegalNotice && !canViewEvidenceDocket,
    });
  } else if (microActionsEnabled && onFileSamadhaan && !readOnly && canSpendFunds) {
    items.push({
      key: "samadhaan",
      label: isMicroProcessing
        ? "Processing..."
        : "Generate Samadhaan Kit (₹499)",
      onClick: () => onFileSamadhaan(ledger),
      disabled: isMicroProcessing,
      dividerBefore: !hasLegalNotice && Boolean(onIssueLegalNotice),
    });
  }

  if (!hasAnyAction) {
    return <span className="text-xs text-recoverpe-grey-medium">—</span>;
  }

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Ledger actions"
        onClick={() => setIsOpen((open) => !open)}
        className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md border border-recoverpe-grey-light bg-recoverpe-white text-recoverpe-black transition-all duration-200 ease-out hover:bg-recoverpe-grey-light"
      >
        <span className="text-base leading-none">⋮</span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[15rem] overflow-hidden rounded-md border border-recoverpe-grey-light bg-recoverpe-white py-1 shadow-none"
        >
          {items.map((item) => (
            <div key={item.key}>
              {item.dividerBefore ? (
                <div
                  role="separator"
                  className="my-1 border-t border-recoverpe-grey-light"
                />
              ) : null}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                className="focus-ring block w-full px-3 py-2 text-left text-sm text-recoverpe-black transition-all duration-200 ease-out hover:bg-recoverpe-grey-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
