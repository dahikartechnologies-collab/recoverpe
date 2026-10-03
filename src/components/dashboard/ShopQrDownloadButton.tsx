"use client";

import { useState } from "react";
import { KhataStandeePrintView } from "@/components/khata/KhataStandeePrintView";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { generateKhataStandeePoster } from "@/lib/khata-standee";

interface ShopQrDownloadButtonProps {
  businessId: string;
  businessName: string;
  variant?: "primary" | "secondary";
}

export function ShopQrDownloadButton({
  businessId,
  businessName,
  variant = "secondary",
}: ShopQrDownloadButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleDownloadPng() {
    setIsGenerating(true);

    try {
      const posterDataUrl = await generateKhataStandeePoster({
        businessId,
        businessName,
      });

      const link = document.createElement("a");
      link.href = posterDataUrl;
      link.download = `${businessName.replace(/\s+/g, "-").toLowerCase()}-khata-standee.png`;
      link.click();
    } finally {
      setIsGenerating(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        onClick={() => setIsOpen(true)}
      >
        Download My Shop QR
      </Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Khata standee"
        panelClassName="max-w-2xl"
        bodyClassName="max-h-[75vh]"
      >
        <div className="space-y-4">
          <p className="text-sm text-recoverpe-muted">
            Print this standee or download a PNG. The footer stays inside the page
            margin so the RecoverPe mark is not clipped.
          </p>
          <div className="flex justify-center bg-[#F8FAFC] p-4">
            <KhataStandeePrintView
              businessId={businessId}
              businessName={businessName}
            />
          </div>
          <div className="no-print flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={handlePrint}>
              Print / Save as PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleDownloadPng()}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : "Download PNG"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
