import { describe, expect, it } from "vitest";
import {
  detectPaymentProofMimeType,
  resolveTrustedPaymentProofMimeType,
} from "@/lib/payment-proof-upload";

describe("payment proof upload validation", () => {
  it("detects JPEG, PNG, WEBP, and PDF from magic bytes", () => {
    expect(
      detectPaymentProofMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))
    ).toBe("image/jpeg");

    expect(
      detectPaymentProofMimeType(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe("image/png");

    const webp = Buffer.alloc(12);
    webp.write("RIFF", 0);
    webp.write("WEBP", 8);
    expect(detectPaymentProofMimeType(webp)).toBe("image/webp");

    expect(
      detectPaymentProofMimeType(Buffer.from("%PDF-1.7\n%", "ascii"))
    ).toBe("application/pdf");
  });

  it("rejects spoofed content types", () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(
      resolveTrustedPaymentProofMimeType({
        declaredType: "image/jpeg",
        fileBuffer: pngBytes,
      })
    ).toBeNull();
  });

  it("accepts matching declared and detected types", () => {
    const pdfBytes = Buffer.from("%PDF-1.4", "ascii");

    expect(
      resolveTrustedPaymentProofMimeType({
        declaredType: "application/pdf",
        fileBuffer: pdfBytes,
      })
    ).toBe("application/pdf");
  });
});
