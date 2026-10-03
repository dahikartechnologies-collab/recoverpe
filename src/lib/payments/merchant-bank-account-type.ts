export type MerchantBankAccountType = "business" | "personal";

export function parseMerchantBankAccountType(
  value: unknown
): MerchantBankAccountType {
  return value === "personal" ? "personal" : "business";
}

export function shouldMarkAccountPrimary(existingVerifiedCount: number): boolean {
  return existingVerifiedCount <= 0;
}
