"use client";

import { useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

type DialerState = "idle" | "connecting" | "connected" | "speaking" | "error";

const STATE_LABEL: Record<DialerState, string> = {
  idle: "Ready",
  connecting: "Connecting…",
  connected: "Connected",
  speaking: "Assistant speaking",
  error: "Error",
};

export function WebDialer() {
  const vapiRef = useRef<Vapi | null>(null);
  const [state, setState] = useState<DialerState>("idle");
  const [error, setError] = useState("");

  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY?.trim() ?? "";
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID?.trim() ?? "";
  const isConfigured = Boolean(publicKey && assistantId);

  useEffect(() => {
    if (!publicKey) {
      return;
    }

    const client = new Vapi(publicKey);
    vapiRef.current = client;

    client.on("call-start", () => {
      setError("");
      setState("connected");
    });
    client.on("speech-start", () => setState("speaking"));
    client.on("speech-end", () => setState("connected"));
    client.on("call-end", () => setState("idle"));
    client.on("error", (event) => {
      setState("error");
      const message =
        event instanceof Error
          ? event.message
          : typeof event === "object" &&
              event !== null &&
              "message" in event &&
              typeof (event as { message?: unknown }).message === "string"
            ? (event as { message: string }).message
            : "WebRTC call failed.";
      setError(message);
    });

    return () => {
      void client.stop();
      vapiRef.current = null;
    };
  }, [publicKey]);

  async function startCall() {
    if (!vapiRef.current || !assistantId) {
      setState("error");
      setError("VAPI public key or assistant ID is not configured.");
      return;
    }

    setError("");
    setState("connecting");

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setState("error");
      setError(
        "Microphone permission is required. Allow access in your browser to test the Hindi AI agent."
      );
      return;
    }

    try {
      await vapiRef.current.start(assistantId, {
        variableValues: {
          businessName: "RecoverPe Test",
          debtorName: "Founder",
          balanceDue: "5000",
          paymentLink: "https://www.recoverpe.com/pay/test",
        },
      });
    } catch (startError) {
      setState("error");
      setError(
        startError instanceof Error
          ? startError.message
          : "Failed to start WebRTC call."
      );
    }
  }

  async function endCall() {
    if (!vapiRef.current) {
      return;
    }

    await vapiRef.current.stop();
    setState("idle");
  }

  const isActive = state === "connecting" || state === "connected" || state === "speaking";

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-medium text-recoverpe-black">
          Zero-Cost AI Voice Simulator (WebRTC)
        </p>
        <p className="mt-1 text-sm text-recoverpe-grey-medium">
          Bypass PSTN routing and talk to your VAPI dashboard assistant directly
          in the browser. Uses Deepgram + ElevenLabs Hindi voice with test
          recovery variables.
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
            Test context — RecoverPe Test · Founder · ₹5,000 pending
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
  );
}
