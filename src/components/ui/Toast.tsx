"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  variant?: "success" | "error";
  onClose: () => void;
}

export function Toast({ message, variant = "success", onClose }: ToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 4000);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  const variantClasses =
    variant === "success"
      ? "border-recoverpe-black bg-recoverpe-black text-recoverpe-white"
      : "border-recoverpe-danger-line bg-recoverpe-danger-fill text-recoverpe-danger-ink";

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <div
        role="status"
        className={`rounded-xl border px-4 py-3 text-sm font-medium ${variantClasses}`}
      >
        {message}
      </div>
    </div>
  );
}
