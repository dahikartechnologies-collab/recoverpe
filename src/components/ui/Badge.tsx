import { HTMLAttributes } from "react";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral:
    "border-recoverpe-line bg-recoverpe-fill text-recoverpe-grey-medium",
  success:
    "border-recoverpe-success-line bg-recoverpe-success-fill text-recoverpe-success-ink",
  warning:
    "border-recoverpe-warning-line bg-recoverpe-warning-fill text-recoverpe-warning-ink",
  danger:
    "border-recoverpe-danger-line bg-recoverpe-danger-fill text-recoverpe-danger-ink",
  info: "border-recoverpe-line-strong bg-recoverpe-white text-recoverpe-black",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${TONE_CLASS[tone]} ${className}`}
      {...props}
    />
  );
}
