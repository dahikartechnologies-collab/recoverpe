"use client";

import { useEffect, useState } from "react";

const CONFETTI_COLORS = ["#0A0A0A", "#FFFFFF", "#10B981", "#F3F4F6"];

interface ConfettiBurstProps {
  active: boolean;
  durationMs?: number;
}

export function ConfettiBurst({ active, durationMs = 3000 }: ConfettiBurstProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      return;
    }

    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), durationMs);

    return () => window.clearTimeout(timer);
  }, [active, durationMs]);

  if (!visible) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      {Array.from({ length: 48 }).map((_, index) => {
        const left = `${(index * 17) % 100}%`;
        const delay = `${(index % 10) * 0.08}s`;
        const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];

        return (
          <span
            key={index}
            className="confetti-piece absolute top-0 block h-2 w-1 rounded-sm opacity-90"
            style={{
              left,
              backgroundColor: color,
              animationDelay: delay,
            }}
          />
        );
      })}
    </div>
  );
}
