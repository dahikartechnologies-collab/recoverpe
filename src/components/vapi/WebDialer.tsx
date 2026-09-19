"use client";

import { useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";
import type { AssistantOverrides } from "@vapi-ai/web/dist/api";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { formatCurrency } from "@/lib/gst";
import { getTodayDateStringInIst } from "@/lib/timezone";
import {
  buildSnehaAssistantOverrides,
  type VapiCallContext,
} from "@/lib/vapi";
import { VAPI_UNAVAILABLE_TOAST_MESSAGE } from "@/lib/vapi-messages";

type DialerState = "idle" | "connecting" | "connected" | "speaking" | "error";

const STATE_LABEL: Record<DialerState, string> = {
  idle: "Ready",
  connecting: "Connecting…",
  connected: "Connected",
  speaking: "Assistant speaking",
  error: "Error",
};

const WEB_DIALER_TEST_CONTEXT: VapiCallContext = {
  business_name: "RecoverPe Test",
  debtor_name: "Founder",
  balance_due: 5000,
  balance_due_label: formatCurrency(5000),
  days_overdue: 14,
  due_date: getTodayDateStringInIst(),
  invoice_number: "TEST-001",
  ledger_id: "test-ledger",
  owner_phone_number: null,
};

export function WebDialer() {
  const vapiRef = useRef<Vapi | null>(null);
  const [state, setState] = useState<DialerState>("idle");
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY?.trim() ?? "";
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID?.trim() ?? "";
  const isConfigured = Boolean(publicKey && assistantId);
  const snehaOverrides = buildSnehaAssistantOverrides(WEB_DIALER_TEST_CONTEXT);

  function showUnavailableToast() {
    setToastMessage(VAPI_UNAVAILABLE_TOAST_MESSAGE);
  }

  useEffect(() => {
    if (!publicKey) {
      return;
    }

    try {
      const client = new Vapi(publicKey);
      vapiRef.current = client;

      client.on("call-start", () => {
        setError("");
        setState("connected");
      });
      client.on("speech-start", () => setState("speaking"));
      client.on("speech-end", () => setState("connected"));
      client.on("call-end", () => setState("idle"));
      client.on("error", () => {
        setState("error");
        setError(VAPI_UNAVAILABLE_TOAST_MESSAGE);
        showUnavailableToast();
      });

      return () => {
        void client.stop();
        vapiRef.current = null;
      };
    } catch (initError) {
      console.error("[WebDialer] VAPI initialization failed:", initError);
      setState("error");
      setError(VAPI_UNAVAILABLE_TOAST_MESSAGE);
      showUnavailableToast();
    }
  }, [publicKey]);

  async function startCall() {
    if (!vapiRef.current || !assistantId) {
      setState("error");
      setError(VAPI_UNAVAILABLE_TOAST_MESSAGE);
      showUnavailableToast();
      return;
    }

    setError("");
    setState("connecting");

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (permissionError) {
      console.error("[WebDialer] Microphone permission denied:", permissionError);
      setState("error");
      setError(VAPI_UNAVAILABLE_TOAST_MESSAGE);
      showUnavailableToast();
      return;
    }

    try {
      await vapiRef.current.start(
        assistantId,
        snehaOverrides as unknown as AssistantOverrides
      );
    } catch (startError) {
      console.error("[WebDialer] Failed to start WebRTC call:", startError);
      setState("error");
      setError(VAPI_UNAVAILABLE_TOAST_MESSAGE);
      showUnavailableToast();
    }
  }

  async function endCall() {
    if (!vapiRef.current) {
      return;
    }

    await vapiRef.current.stop();
    setState("idle");
  }

  const isActive =
    state === "connecting" || state === "connected" || state === "speaking";

  return (
    <>
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-recoverpe-black">
            Zero-Cost AI Voice Simulator (WebRTC)
          </p>
          <p className="mt-1 text-sm text-recoverpe-grey-medium">
            Bypass PSTN routing and talk to Sneha directly in the browser using
            the same system prompt and first message as live recovery calls.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConfigured ? (
            <p className="text-sm text-recoverpe-error">
              Set `NEXT_PUBLIC_VAPI_PUBLIC_KEY` and `NEXT_PUBLIC_VAPI_ASSISTANT_ID`
              in your environment to enable the WebRTC dialer.
            </p>
          ) : null}

          <div className="rounded-xl border border-recoverpe-grey-light bg-recoverpe-grey-light/40 px-4 py-3 text-sm">
            <p className="font-medium text-recoverpe-black">
              Status: {STATE_LABEL[state]}
            </p>
            <p className="mt-1 text-recoverpe-grey-medium">
              Sneha test context — {WEB_DIALER_TEST_CONTEXT.business_name} ·{" "}
              {WEB_DIALER_TEST_CONTEXT.debtor_name} ·{" "}
              {WEB_DIALER_TEST_CONTEXT.balance_due_label} pending
            </p>
          </div>

          {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => void startCall()}
              disabled={!isConfigured || isActive}
            >
              Start AI Web Call
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void endCall()}
              disabled={!isActive}
            >
              End Call
            </Button>
          </div>
        </CardContent>
      </Card>

      {toastMessage ? (
        <Toast
          message={toastMessage}
          variant="error"
          onClose={() => setToastMessage(null)}
        />
      ) : null}
    </>
  );
}
