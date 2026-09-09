"use client";

import { LucideIcon } from "lucide-react";

interface PremiumToggleCardProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
  icon: LucideIcon;
}

export function PremiumToggleCard({
  checked,
  onChange,
  title,
  description,
  icon: Icon,
}: PremiumToggleCardProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`group flex w-full items-center gap-4 rounded-xl border px-4 py-4 text-left transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] focus-visible:ring-offset-2 sm:px-5 sm:py-5 ${
        checked
          ? "border-emerald-500 bg-emerald-50/50 shadow-sm"
          : "border-slate-300 bg-white shadow-sm hover:border-slate-400"
      }`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors duration-300 ${
          checked
            ? "border-emerald-200 bg-emerald-100 text-emerald-600"
            : "border-slate-200 bg-slate-50 text-slate-400 group-hover:border-slate-300"
        }`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-semibold transition-colors duration-300 sm:text-base ${
            checked ? "text-recoverpe-black" : "text-slate-700"
          }`}
        >
          {title}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-recoverpe-grey-medium sm:text-sm">
          {description}
        </p>
      </div>

      <div
        className="pointer-events-none shrink-0"
        aria-hidden
      >
        <span
          className={`relative inline-flex h-7 w-12 rounded-full shadow-inner transition-colors duration-300 ${
            checked ? "bg-emerald-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full border border-slate-200 bg-white shadow-md transition-transform duration-300 ease-in-out ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </span>
      </div>
    </button>
  );
}
