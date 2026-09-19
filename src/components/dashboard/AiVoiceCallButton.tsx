"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";
import { PremiumUpgradeLock } from "@/components/billing/PremiumUpgradeLock";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { initiateVapiOutboundCall } from "@/lib/vapi-client";
import { VAPI_UNAVAILABLE_TOAST_MESSAGE } from "@/lib/vapi-messages";
import { useActiveBusinessEntitlements } from "@/lib/use-active-business-entitlement";

interface AiVoiceCallButtonProps {
  ledgerId: string;
  contactId: string;
  disabled?: boolean;
  compact?: boolean;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export function AiVoiceCallButton({
  ledgerId,
  contactId,
  disabled = false,
  compact = false,
  onSuccess,
  onError,
}: AiVoiceCallButtonProps) {
  const { hasEntitlement } = useActiveBusinessEntitlements();
  const canUseAiVoice = hasEntitlement("ai_voice_calls");
  const [isCalling, setIsCalling] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  async function handleCall() {
    if (!canUseAiVoice) {
      setShowUpgrade(true);
      return;
    }

    setIsCalling(true);

    try {
      await initiateVapiOutboundCall({
        ledger_id: ledgerId,
        contact_id: contactId,
      });

      onSuccess?.("AI Agent is dialing the customer.");
    } catch (error) {
      console.error("[AiVoiceCallButton] VAPI call failed:", error);

      const message =
        error instanceof Error &&
        error.message.toLowerCase().includes("premium")
          ? error.message
          : VAPI_UNAVAILABLE_TOAST_MESSAGE;

      if (message.toLowerCase().includes("premium")) {
        setShowUpgrade(true);
      }

      onError?.(message);
    } finally {
      setIsCalling(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={compact ? "ghost" : "secondary"}
        size={compact ? "sm" : "md"}
        disabled={disabled || isCalling}
        onClick={() => void handleCall()}
      >
        <Phone className="h-4 w-4" aria-hidden />
        {isCalling ? "Calling…" : "AI Voice Call"}
      </Button>

      <Modal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        title="Premium feature"
      >
        <PremiumUpgradeLock
          eyebrow="Premium feature"
          ctaLabel="Upgrade to Premium"
          title="AI Voice Calls"
          description="Outbound Hindi/English recovery calls with full transcript logging in your Live Inbox are available on Premium."
        />
        <div className="mt-4 flex justify-end">
          <Link href="/dashboard/billing" onClick={() => setShowUpgrade(false)}>
            <Button type="button">View plans</Button>
          </Link>
        </div>
      </Modal>
    </>
  );
}
