"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone } from "lucide-react";
import { PremiumUpgradeLock } from "@/components/billing/PremiumUpgradeLock";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { initiateVapiOutboundCall } from "@/lib/vapi-client";
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
      const result = await initiateVapiOutboundCall({
        ledger_id: ledgerId,
        contact_id: contactId,
      });

      onSuccess?.(
        result.simulated
          ? "AI voice call simulated (development mode)."
          : result.message || "AI voice call initiated."
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to initiate AI voice call.";

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
        variant={compact ? "secondary" : "secondary"}
        disabled={disabled || isCalling}
        onClick={() => void handleCall()}
        className={compact ? "inline-flex items-center gap-2 px-3 py-2" : undefined}
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
