export const FREE_TIER_WHATSAPP_WATERMARK =
  "Recovered instantly via Recoverpe.com. Click to automate your collections.";

export function getAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}`;
  }

  return "https://www.recoverpe.com";
}

export function getPayPageUrl(ledgerId: string): string {
  return `${getAppBaseUrl()}/pay/${ledgerId}`;
}

export function getDebtorPortalUrl(sessionId: string): string {
  return `${getAppBaseUrl()}/portal/${sessionId}`;
}
