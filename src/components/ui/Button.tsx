import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex min-h-11 items-center justify-center rounded-md px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary:
      "border border-recoverpe-black bg-recoverpe-black text-recoverpe-white hover:bg-recoverpe-grey-medium hover:border-recoverpe-grey-medium",
    secondary:
      "border border-recoverpe-black bg-recoverpe-white text-recoverpe-black hover:bg-recoverpe-grey-light",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
