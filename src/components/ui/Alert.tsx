import { HTMLAttributes, ReactNode } from "react";

type AlertTone = "neutral" | "success" | "warning" | "danger";

const TONE_CLASS: Record<AlertTone, string> = {
  neutral:
    "border-recoverpe-line bg-recoverpe-fill/60 text-recoverpe-black",
  success:
    "border-recoverpe-success-line bg-recoverpe-success-fill text-recoverpe-black",
  warning:
    "border-recoverpe-warning-line bg-recoverpe-warning-fill text-recoverpe-black",
  danger:
    "border-recoverpe-danger-line bg-recoverpe-danger-fill text-recoverpe-black",
};

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  title?: string;
  action?: ReactNode;
}

export function Alert({
  tone = "neutral",
  title,
  action,
  className = "",
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role="status"
      className={`rounded-xl border px-4 py-3 text-sm ${TONE_CLASS[tone]} ${className}`}
      {...props}
    >
      {title ? (
        <p className="font-medium text-recoverpe-black">{title}</p>
      ) : null}
      {children ? (
        <div className={title ? "mt-1 text-recoverpe-muted" : undefined}>
          {children}
        </div>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
