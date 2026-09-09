export function normalizeWhatsAppPhoneForWaMe(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");

  if (digits.startsWith("91") && digits.length === 12) {
    return digits;
  }

  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
}

export function buildWhatsAppMeLink(
  phoneNumber: string,
  message: string
): string {
  const recipient = normalizeWhatsAppPhoneForWaMe(phoneNumber);
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${recipient}?text=${encodedMessage}`;
}
