"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
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
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleDownload() {
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

  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => void handleDownload()}
      disabled={isGenerating}
    >
      {isGenerating ? "Generating..." : "Download My Shop QR"}
    </Button>
  );
}
