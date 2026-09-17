import { SelectHTMLAttributes, forwardRef } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={`focus-ring w-full rounded-md border border-recoverpe-line bg-recoverpe-white px-3 py-2.5 text-sm text-recoverpe-black transition-colors duration-150 ease-out focus:border-recoverpe-black disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
    );
  }
);

Select.displayName = "Select";
