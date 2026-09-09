import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePDF } from "@/components/pdf/InvoicePDF";
import { TaxInvoicePDF } from "@/components/pdf/TaxInvoicePDF";
import {
  LegalNoticePDF,
  LegalNoticePDFProps,
} from "@/components/pdf/LegalNoticePDF";
import {
  LegalDocketPDF,
  LegalDocketPDFProps,
} from "@/components/pdf/LegalDocketPDF";
import {
  CommunicationLogEntry,
  SamadhaanDocketPDF,
  SamadhaanDocketPDFProps,
} from "@/components/pdf/SamadhaanDocketPDF";
import { GstBreakdown } from "@/lib/gst";
import { resolveAdvocateSignatureSrc } from "@/lib/legal-notice-assets";
import { generateUPIIntent, generateUPIQRCodeBase64 } from "@/lib/upi";

export type { CommunicationLogEntry };

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
  msmeRegNo?: string | null;
  showRecoverpeBranding?: boolean;
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

  const sharedProps = {
    invoiceNumber: input.invoiceNumber,
    invoiceDate: input.invoiceDate,
    dueDate: input.dueDate,
    businessName: input.businessName,
    businessGstin: input.businessGstin,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    clientGstin: input.clientGstin,
    gstBreakdown: input.gstBreakdown,
    qrCodeBase64,
    msmeRegNo: input.msmeRegNo ?? null,
    showRecoverpeBranding: input.showRecoverpeBranding ?? true,
  };

  const element =
    input.gstBreakdown.documentType === "tax_invoice" ? (
      <TaxInvoicePDF {...sharedProps} />
    ) : (
      <InvoicePDF
        {...sharedProps}
        businessLogoUrl={input.businessLogoUrl}
        upiUri={upiUri}
      />
    );

  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}

export async function renderLegalNoticePdfBuffer(
  input: LegalNoticePDFProps
): Promise<Buffer> {
  const signatureImageSrc =
    input.signatureImageSrc ?? resolveAdvocateSignatureSrc();

  const buffer = await renderToBuffer(
    <LegalNoticePDF {...input} signatureImageSrc={signatureImageSrc} />
  );
  return Buffer.from(buffer);
}

export async function renderSamadhaanDocketPdfBuffer(
  input: SamadhaanDocketPDFProps
): Promise<Buffer> {
  const buffer = await renderToBuffer(<SamadhaanDocketPDF {...input} />);
  return Buffer.from(buffer);
}

export async function renderLegalDocketPdfBuffer(
  input: LegalDocketPDFProps
): Promise<Buffer> {
  const buffer = await renderToBuffer(<LegalDocketPDF {...input} />);
  return Buffer.from(buffer);
}
