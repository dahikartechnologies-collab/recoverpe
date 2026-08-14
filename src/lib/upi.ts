import QRCode from "qrcode";

export function generateUPIIntent(
  vpa: string,
  name: string,
  amount: number,
  invoiceId: string
): string {
  const params = new URLSearchParams({
    pa: vpa.trim(),
    pn: name.trim(),
    am: amount.toFixed(2),
    tr: invoiceId,
    tn: "Payment_for_Recoverpe",
  });

  return `upi://pay?${params.toString()}`;
}

export async function generateUPIQRCodeBase64(upiUri: string): Promise<string> {
  return QRCode.toDataURL(upiUri, {
    margin: 1,
    width: 128,
    color: {
      dark: "#0A0A0A",
      light: "#FFFFFF",
    },
  });
}
