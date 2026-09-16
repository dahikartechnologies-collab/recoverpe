export interface BriefingBullet {
  label: string;
  detail: string;
  tone: "neutral" | "success" | "warning" | "danger";
}

export interface BriefingMetrics {
  collected_inr: number;
  proofs_pending: number;
  promises_broken: number;
  whatsapp_failed: number;
}

export interface DailyBriefing {
  headline: string;
  bullets: BriefingBullet[];
  metrics: BriefingMetrics;
  model: string;
  briefing_date: string;
}
