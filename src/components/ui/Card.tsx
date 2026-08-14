import { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-recoverpe-grey-light bg-recoverpe-white ${className}`}
      {...props}
    />
  );
}

type CardSectionProps = HTMLAttributes<HTMLDivElement>;

export function CardHeader({ className = "", ...props }: CardSectionProps) {
  return (
    <div
      className={`border-b border-recoverpe-grey-light px-6 py-4 ${className}`}
      {...props}
    />
  );
}

export function CardContent({ className = "", ...props }: CardSectionProps) {
  return <div className={`px-6 py-4 ${className}`} {...props} />;
}
