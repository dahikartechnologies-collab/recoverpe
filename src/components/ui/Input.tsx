import { InputHTMLAttributes, forwardRef } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`focus-ring w-full rounded-md border border-recoverpe-line bg-recoverpe-white px-3 py-2.5 text-sm text-recoverpe-black transition-colors duration-150 ease-out placeholder:text-recoverpe-subtle focus:border-recoverpe-black disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
