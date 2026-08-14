import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/pdf/InvoicePDF";
import { GstBreakdown } from "@/lib/gst";
import { generateUPIIntent, generateUPIQRCodeBase64 } from "@/lib/upi";

export interface InvoiceRenderInput {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  businessName: string;
  businessGstin: string | null;
  businessLogoUrl: string | null;
  contactName: string;
  contactPhone: string;
  clientGstin: string | null;
  gstBreakdown: GstBreakdown;
  upiVpa: string;
  ledgerId: string;
}

export async function renderInvoicePdfBuffer(
  input: InvoiceRenderInput
): Promise<Buffer> {
  const upiUri = generateUPIIntent(
    input.upiVpa,
    input.businessName,
    input.gstBreakdown.totalAmount,
    input.invoiceNumber || input.ledgerId
  );
  const qrCodeBase64 = await generateUPIQRCodeBase64(upiUri);

  const element = (
    <InvoicePDF
      invoiceNumber={input.invoiceNumber}
      invoiceDate={input.invoiceDate}
      dueDate={input.dueDate}
      businessName={input.businessName}
      businessGstin={input.businessGstin}
      businessLogoUrl={input.businessLogoUrl}
      contactName={input.contactName}
      contactPhone={input.contactPhone}
      clientGstin={input.clientGstin}
      gstBreakdown={input.gstBreakdown}
      qrCodeBase64={qrCodeBase64}
      upiUri={upiUri}
    />
  );

  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
