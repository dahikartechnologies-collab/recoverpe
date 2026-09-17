import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "focus-ring rp-press inline-flex items-center justify-center font-medium disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";
  const sizes = {
    sm: "h-8 rounded-md px-3 text-xs",
    md: "h-10 rounded-md px-4 text-sm",
    lg: "min-h-11 rounded-md px-5 py-2.5 text-sm",
  };
  const variants = {
    primary:
      "border border-recoverpe-black bg-recoverpe-black text-recoverpe-white hover:bg-recoverpe-grey-medium hover:border-recoverpe-grey-medium",
    secondary:
      "border border-recoverpe-line-strong bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-fill",
    ghost:
      "border border-transparent bg-transparent text-recoverpe-grey-medium hover:bg-recoverpe-fill hover:text-recoverpe-black",
    danger:
      "border border-recoverpe-danger-line bg-recoverpe-danger-fill text-recoverpe-danger-ink hover:bg-recoverpe-danger-line/40",
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
