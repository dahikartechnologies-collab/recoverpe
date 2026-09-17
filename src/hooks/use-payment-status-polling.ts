"use client";

import { useEffect, useRef } from "react";

interface PaymentStatusPayload {
  is_paid?: boolean;
  is_settled?: boolean;
}

export function usePaymentStatusPolling(options: {
  statusUrl: string | null;
  enabled: boolean;
  intervalMs?: number;
  onPaid: () => void;
}) {
  const onPaidRef = useRef(options.onPaid);
  onPaidRef.current = options.onPaid;

  useEffect(() => {
    if (!options.enabled || !options.statusUrl) {
      return;
    }

    let cancelled = false;
    let intervalId: number | null = null;

    function stopPolling() {
      cancelled = true;

      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    }

    async function pollStatus() {
      if (cancelled) {
        return;
      }

      try {
        const response = await fetch(options.statusUrl!, { cache: "no-store" });

        if (!response.ok || cancelled) {
          return;
        }

        const payload = (await response.json()) as PaymentStatusPayload;

        if (payload.is_paid || payload.is_settled) {
          stopPolling();
          onPaidRef.current();
        }
      } catch {
        // Polling failures must not interrupt checkout UX.
      }
    }

    void pollStatus();
    intervalId = window.setInterval(() => {
      void pollStatus();
    }, options.intervalMs ?? 5000);

    return () => {
      stopPolling();
    };
  }, [options.enabled, options.intervalMs, options.statusUrl]);
}
