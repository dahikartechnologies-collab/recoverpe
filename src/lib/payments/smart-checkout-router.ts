import { createHash } from "crypto";
import { isZeroMdrCheckoutEligible } from "@/lib/entitlements";
import { BusinessEntitlementRow } from "@/lib/entitlements";

export const ZERO_MDR_THRESHOLD_INR = 2_000;

export type SmartCheckoutMode = "upi_standard" | "zero_mdr_bank";

export interface SmartCheckoutBankRail {
  beneficiaryName: string;
  accountNumber: string;
  ifsc: string;
  amount: number;
  paymentReference: string;
}

export interface SmartCheckoutUpiRail {
  vpa: string;
  amount: number;
  transactionReference: string;
}

export interface SmartCheckoutDecision {
  mode: SmartCheckoutMode;
  amount: number;
  paymentReference: string;
  upi?: SmartCheckoutUpiRail;
  bank?: SmartCheckoutBankRail;
  smartCollectReady: boolean;
}

export function buildPaymentReference(
  ledgerId: string,
  invoiceNumber: string | null
): string {
  const invoiceToken =
    invoiceNumber?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase() ||
    ledgerId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const hash = createHash("sha256")
    .update(ledgerId)
    .digest("hex")
    .slice(0, 4)
    .toUpperCase();

  return `RP-${invoiceToken}-${hash}`;
}

export function resolveSmartCheckout(input: {
  amount: number;
  ledgerId: string;
  invoiceNumber: string | null;
  business: BusinessEntitlementRow | null;
  businessName: string | null;
  merchantVpa: string | null;
  virtualBankAccountNumber: string | null;
  virtualIfscCode: string | null;
}): SmartCheckoutDecision {
  const paymentReference = buildPaymentReference(
    input.ledgerId,
    input.invoiceNumber
  );
  const smartCollectReady = Boolean(
    input.virtualBankAccountNumber && input.virtualIfscCode
  );
  const useZeroMdrBank =
    input.amount > ZERO_MDR_THRESHOLD_INR &&
    isZeroMdrCheckoutEligible(input.business) &&
    smartCollectReady;

  if (useZeroMdrBank) {
    return {
      mode: "zero_mdr_bank",
      amount: input.amount,
      paymentReference,
      smartCollectReady,
      bank: {
        beneficiaryName: input.businessName ?? "RecoverPe Merchant",
        accountNumber: input.virtualBankAccountNumber!,
        ifsc: input.virtualIfscCode!,
        amount: input.amount,
        paymentReference,
      },
    };
  }

  return {
    mode: "upi_standard",
    amount: input.amount,
    paymentReference,
    smartCollectReady,
    upi: input.merchantVpa
      ? {
          vpa: input.merchantVpa,
          amount: input.amount,
          transactionReference: paymentReference,
        }
      : undefined,
  };
}
