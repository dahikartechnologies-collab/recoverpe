export interface PasswordRequirement {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

/** Matches Firebase Auth password policy for Recoverpe registration. */
export const REGISTER_PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: "min-length",
    label: "At least 6 characters",
    test: (password) => password.length >= 6,
  },
  {
    id: "special-char",
    label: "Contains a special character (!@#$...)",
    test: (password) => /[^a-zA-Z0-9]/.test(password),
  },
];

export function evaluatePasswordRequirements(password: string) {
  return REGISTER_PASSWORD_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    met: requirement.test(password),
  }));
}

export function isRegisterPasswordValid(password: string): boolean {
  return evaluatePasswordRequirements(password).every((requirement) => requirement.met);
}

export function getRegisterPasswordValidationMessage(password: string): string | null {
  const unmet = evaluatePasswordRequirements(password).find(
    (requirement) => !requirement.met
  );

  return unmet ? unmet.label : null;
}

/** Matches Firebase Auth password policy for password reset. */
export const RESET_PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: "min-length",
    label: "At least 8 characters",
    test: (password) => password.length >= 8,
  },
  {
    id: "special-char",
    label: "Contains a special character (!@#$...)",
    test: (password) => /[^a-zA-Z0-9]/.test(password),
  },
];

export function evaluateResetPasswordRequirements(password: string) {
  return RESET_PASSWORD_REQUIREMENTS.map((requirement) => ({
    ...requirement,
    met: requirement.test(password),
  }));
}

export function isResetPasswordValid(password: string): boolean {
  return evaluateResetPasswordRequirements(password).every(
    (requirement) => requirement.met
  );
}

export function getResetPasswordValidationMessage(password: string): string | null {
  const unmet = evaluateResetPasswordRequirements(password).find(
    (requirement) => !requirement.met
  );

  return unmet ? unmet.label : null;
}
