"use client";

import { Check } from "lucide-react";
import {
  evaluatePasswordRequirements,
  evaluateResetPasswordRequirements,
  type PasswordRequirement,
} from "@/lib/password-policy";

interface PasswordRequirementsProps {
  password: string;
  mode?: "register" | "reset";
  requirements?: PasswordRequirement[];
}

export function PasswordRequirements({
  password,
  mode = "register",
  requirements,
}: PasswordRequirementsProps) {
  const evaluatedRequirements = requirements
    ? requirements.map((requirement) => ({
        ...requirement,
        met: requirement.test(password),
      }))
    : mode === "reset"
      ? evaluateResetPasswordRequirements(password)
      : evaluatePasswordRequirements(password);

  return (
    <ul
      className="mt-2 space-y-1.5"
      aria-live="polite"
      aria-label="Password requirements"
    >
      {evaluatedRequirements.map((requirement) => (
        <li
          key={requirement.id}
          className={`flex items-center gap-2 text-xs transition-colors ${
            requirement.met
              ? "font-medium text-recoverpe-success"
              : "text-recoverpe-grey-medium"
          }`}
        >
          <span
            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
              requirement.met
                ? "border-recoverpe-success bg-recoverpe-success text-recoverpe-white"
                : "border-recoverpe-line bg-recoverpe-white"
            }`}
            aria-hidden
          >
            {requirement.met ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
          </span>
          <span>{requirement.label}</span>
        </li>
      ))}
    </ul>
  );
}
