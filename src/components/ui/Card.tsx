import { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-recoverpe-line bg-recoverpe-white ${className}`}
      {...props}
    />
  );
}

type CardSectionProps = HTMLAttributes<HTMLDivElement>;

export function CardHeader({ className = "", ...props }: CardSectionProps) {
  return (
    <div
      className={`border-b border-recoverpe-line px-6 py-4 ${className}`}
      {...props}
    />
  );
}

export function CardContent({ className = "", ...props }: CardSectionProps) {
  return <div className={`p-6 ${className}`} {...props} />;
}
