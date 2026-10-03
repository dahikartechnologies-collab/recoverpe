"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getKhataQrUrl } from "@/lib/khata-qr";

interface KhataStandeePrintViewProps {
  businessId: string;
  businessName: string;
}

export function KhataStandeePrintView({
  businessId,
  businessName,
}: KhataStandeePrintViewProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const qrPageUrl = getKhataQrUrl(businessId);

  useEffect(() => {
    let cancelled = false;

    void QRCode.toDataURL(qrPageUrl, {
      width: 420,
      margin: 2,
      color: { dark: "#0A192F", light: "#FFFFFF" },
    }).then((url) => {
      if (!cancelled) {
        setQrDataUrl(url);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [qrPageUrl]);

  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm 12mm 16mm 12mm;
        }
        @media print {
          .no-print { display: none !important; }
          body * { visibility: hidden !important; }
          #khata-standee-print, #khata-standee-print * { visibility: visible !important; }
          #khata-standee-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
      <article
        id="khata-standee-print"
        className="flex min-h-[240mm] w-full max-w-[190mm] flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white"
      >
        <header className="bg-[#0A192F] px-8 py-7 text-center text-white">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-emerald-300">
            KHATA PAYMENT STAND
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">{businessName}</h2>
        </header>
        <div className="h-1.5 bg-[#10B981]" />

        <div className="flex flex-1 flex-col items-center px-8 py-8">
          <div className="w-full max-w-sm rounded-xl border border-[#E5E7EB] bg-white p-6">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`Khata QR for ${businessName}`}
                className="mx-auto h-64 w-64"
              />
            ) : (
              <div className="mx-auto h-64 w-64 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC]" />
            )}
            <p className="mt-4 text-center text-base font-semibold text-[#0A0A0A]">
              Scan to Pay &amp; Open Khata
            </p>
            <p className="mt-1 text-center text-xs text-[#00695C]">
              UPI · Instant settlement · Digital ledger
            </p>
          </div>

          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-[#0A0A0A]">
            Accepted Here
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {["UPI", "RuPay", "BHIM", "BharatQR"].map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-[#E5E7EB] px-3 py-1 text-[11px] font-semibold text-[#00695C]"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        <footer className="relative mt-auto border-t-2 border-[#00695C] bg-white px-8 py-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/recoverpelogo.png"
            alt="RecoverPe"
            className="mx-auto h-20 w-auto max-w-[220px] object-contain"
          />
          <p className="mt-2 text-sm font-semibold text-[#0A0A0A]">Powered by RecoverPe</p>
        </footer>
      </article>
    </>
  );
}
