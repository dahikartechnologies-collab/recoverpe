"use client";

import { ReactNode, useEffect, useState } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  bodyClassName?: string;
  disableClose?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  bodyClassName = "",
  disableClose = false,
}: ModalProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsVisible(false);
      return;
    }

    const frame = requestAnimationFrame(() => {
      setIsVisible(true);
    });

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !disableClose) {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose, disableClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close modal"
        className={`absolute inset-0 bg-recoverpe-black/40 transition-opacity duration-200 ease-out ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={disableClose ? undefined : onClose}
        disabled={disableClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-recoverpe-grey-light bg-recoverpe-white transition-all duration-200 ease-out ${
          isVisible
            ? "translate-y-0 opacity-100"
            : "translate-y-2 opacity-0"
        }`}
      >
        <div className="shrink-0 border-b border-recoverpe-grey-light px-6 py-4">
          <h2 id="modal-title" className="text-lg font-semibold text-recoverpe-black">
            {title}
          </h2>
        </div>
        <div className={`overflow-y-auto px-6 py-4 ${bodyClassName}`}>{children}</div>
      </div>
    </div>
  );
}
