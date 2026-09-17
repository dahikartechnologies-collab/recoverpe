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

    async function pollStatus() {
      try {
        const response = await fetch(options.statusUrl!, { cache: "no-store" });

        if (!response.ok || cancelled) {
          return;
        }

        const payload = (await response.json()) as PaymentStatusPayload;

        if (payload.is_paid || payload.is_settled) {
          onPaidRef.current();
        }
      } catch {
        // Polling failures must not interrupt checkout UX.
      }
    }

    void pollStatus();
    const interval = window.setInterval(() => {
      void pollStatus();
    }, options.intervalMs ?? 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [options.enabled, options.intervalMs, options.statusUrl]);
}
