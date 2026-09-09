import { Business } from "@/types";

export function isBusinessProfileCompleteForLegalDocuments(
  business: Business | null | undefined
): boolean {
  if (!business) {
    return false;
  }

  const gstin = business.gstin?.trim();
  const address = business.business_address?.trim();

  return Boolean(gstin && address);
}
