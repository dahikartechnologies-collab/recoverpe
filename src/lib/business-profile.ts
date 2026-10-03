import { Business } from "@/types";

export function isGstRegistrationDeclared(
  business: Pick<Business, "gstin" | "gst_not_required"> | null | undefined
): boolean {
  if (!business) {
    return false;
  }

  return Boolean(business.gstin?.trim()) || Boolean(business.gst_not_required);
}

export function isBusinessProfileCompleteForLegalDocuments(
  business: Business | null | undefined
): boolean {
  if (!business) {
    return false;
  }

  return isGstRegistrationDeclared(business);
}
