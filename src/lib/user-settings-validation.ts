import { formatIndianPhoneNumber } from "@/lib/invoices";

export interface UpdateUserSettingsPayload {
  full_name?: string | null;
  billing_address?: string | null;
  alternate_phone?: string | null;
  default_upi_vpa?: string | null;
}

export interface ValidatedUserSettingsUpdate {
  full_name?: string | null;
  billing_address?: string | null;
  alternate_phone?: string | null;
  default_upi_vpa?: string | null;
}

const FULL_NAME_MAX_LENGTH = 120;
const BILLING_ADDRESS_MAX_LENGTH = 500;

function isValidUpiVpa(value: string): boolean {
  return /^[\w.\-]{2,256}@[\w.\-]{2,64}$/.test(value);
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateUserSettingsUpdate(
  body: UpdateUserSettingsPayload
): { data?: ValidatedUserSettingsUpdate; error?: string } {
  const hasUpdatableField =
    body.full_name !== undefined ||
    body.billing_address !== undefined ||
    body.alternate_phone !== undefined ||
    body.default_upi_vpa !== undefined;

  if (!hasUpdatableField) {
    return { error: "No settings fields provided to update." };
  }

  const update: ValidatedUserSettingsUpdate = {};

  if (body.full_name !== undefined) {
    const fullName = normalizeOptionalString(body.full_name);

    if (fullName && fullName.length < 2) {
      return { error: "Full name must be at least 2 characters." };
    }

    if (fullName && fullName.length > FULL_NAME_MAX_LENGTH) {
      return {
        error: `Full name must be ${FULL_NAME_MAX_LENGTH} characters or fewer.`,
      };
    }

    update.full_name = fullName;
  }

  if (body.billing_address !== undefined) {
    const billingAddress = normalizeOptionalString(body.billing_address);

    if (billingAddress && billingAddress.length > BILLING_ADDRESS_MAX_LENGTH) {
      return {
        error: `Billing address must be ${BILLING_ADDRESS_MAX_LENGTH} characters or fewer.`,
      };
    }

    update.billing_address = billingAddress;
  }

  if (body.alternate_phone !== undefined) {
    const alternatePhone = normalizeOptionalString(body.alternate_phone);

    if (alternatePhone) {
      const digits = alternatePhone.replace(/\D/g, "");

      if (digits.length !== 10 && !(digits.startsWith("91") && digits.length === 12)) {
        return {
          error: "Alternate mobile must be a valid 10-digit Indian number.",
        };
      }

      update.alternate_phone = formatIndianPhoneNumber(alternatePhone);
    } else {
      update.alternate_phone = null;
    }
  }

  if (body.default_upi_vpa !== undefined) {
    const upiVpa = normalizeOptionalString(body.default_upi_vpa);

    if (upiVpa && !isValidUpiVpa(upiVpa)) {
      return { error: "Enter a valid UPI VPA (e.g. merchant@upi)." };
    }

    update.default_upi_vpa = upiVpa;
  }

  return { data: update };
}
