import { getAppBaseUrl } from "@/lib/app-url";

export function buildAgentReferralJoinUrl(referralCode: string): string {
  return `${getAppBaseUrl()}/join?ref=${encodeURIComponent(referralCode)}`;
}

export function buildAgentWhatsAppNudgeUrl(input: {
  merchantPhone: string;
  agentName: string;
  referralCode: string;
  businessName?: string | null;
}): string {
  const digits = input.merchantPhone.replace(/\D/g, "");
  const phone = digits.length === 10 ? `91${digits}` : digits;
  const joinUrl = buildAgentReferralJoinUrl(input.referralCode);
  const merchantLabel = input.businessName?.trim() || "there";

  const message = [
    `Hi ${merchantLabel},`,
    "",
    `${input.agentName} from RecoverPe here. Your Premium onboarding is pending.`,
    `Complete verification using this link: ${joinUrl}`,
    "",
    "Reply if you need help.",
  ].join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
