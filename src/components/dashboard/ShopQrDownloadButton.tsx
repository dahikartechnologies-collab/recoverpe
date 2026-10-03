"use client";

import { pdf } from "@react-pdf/renderer";
import { useState } from "react";
import QRCode from "qrcode";
import { KhataStandeePDF } from "@/components/pdf/KhataStandeePDF";
import { KhataStandeePrintView } from "@/components/khata/KhataStandeePrintView";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  fetchPublicAssetDataUrl,
  generateKhataStandeePoster,
} from "@/lib/khata-standee";
import { getKhataQrUrl } from "@/lib/khata-qr";

interface ShopQrDownloadButtonProps {
  businessId: string;
  businessName: string;
  variant?: "primary" | "secondary";
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function ShopQrDownloadButton({
  businessId,
  businessName,
  variant = "secondary",
}: ShopQrDownloadButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGeneratingPng, setIsGeneratingPng] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [error, setError] = useState("");

  const fileStem = businessName.replace(/\s+/g, "-").toLowerCase();

  async function handleDownloadPng() {
    setError("");
    setIsGeneratingPng(true);

    try {
      const posterDataUrl = await generateKhataStandeePoster({
        businessId,
        businessName,
      });

      const link = document.createElement("a");
      link.href = posterDataUrl;
      link.download = `${fileStem}-khata-standee.png`;
      link.click();
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download PNG."
      );
    } finally {
      setIsGeneratingPng(false);
    }
  }

  async function handleDownloadPdf() {
    setError("");
    setIsGeneratingPdf(true);

    try {
      const qrDataUrl = await QRCode.toDataURL(getKhataQrUrl(businessId), {
        width: 640,
        margin: 2,
        color: { dark: "#0A192F", light: "#FFFFFF" },
      });
      const logoDataUrl = await fetchPublicAssetDataUrl("/recoverpelogo.png");
      const blob = await pdf(
        <KhataStandeePDF
          businessName={businessName}
          qrDataUrl={qrDataUrl}
          logoDataUrl={logoDataUrl}
        />
      ).toBlob();

      triggerBlobDownload(blob, `${fileStem}-khata-standee.pdf`);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to download PDF."
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} onClick={() => setIsOpen(true)}>
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
            Download a single-page PDF poster or a high-resolution PNG. The RecoverPe
            mark sits in the footer safe area and is sized to stay readable.
          </p>
          <div className="flex justify-center bg-[#F8FAFC] p-4">
            <KhataStandeePrintView
              businessId={businessId}
              businessName={businessName}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={isGeneratingPdf || isGeneratingPng}
            >
              {isGeneratingPdf ? "Preparing PDF..." : "Download PDF"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleDownloadPng()}
              disabled={isGeneratingPng || isGeneratingPdf}
            >
              {isGeneratingPng ? "Generating..." : "Download PNG"}
            </Button>
          </div>
          {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}
        </div>
      </Modal>
    </>
  );
}
