"use client";

import {
  ConfirmationResult,
  createUserWithEmailAndPassword,
  linkWithPhoneNumber,
  RecaptchaVerifier,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  User,
  UserCredential,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { RecoverpeUser } from "@/types";
import { parseApiJsonResponse } from "@/lib/parse-api-response";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  clearAppRoleCookie,
  clearAuthSessionCookie,
  clearActorUserCookie,
} from "@/lib/auth-cookies";
import { resetFirebaseAuthReadyState } from "@/lib/auth-session";
import { clearWorkspaceCookies } from "@/lib/workspace-context";

export { getFirebaseAuth };

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export function formatIndianMobileNumber(digits: string): string {
  return `+91${digits}`;
}

export function isValidIndianMobileNumber(digits: string): boolean {
  return INDIAN_MOBILE_REGEX.test(digits);
}

export function getFirebaseAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "This email is already registered. Please log in instead.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/weak-password":
        return "Password must be at least 6 characters.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Invalid email or password.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";
      case "auth/invalid-verification-code":
        return "Invalid OTP. Please check the 6-digit code and try again.";
      case "auth/code-expired":
        return "OTP expired. Please request a new code.";
      case "auth/invalid-phone-number":
        return "Invalid mobile number. Enter a valid 10-digit Indian number.";
      case "auth/credential-already-in-use":
        return "This mobile number is already linked to another account. Please log in to that account.";
      case "auth/phone-number-already-exists":
        return "This mobile number is already linked to another account.";
      case "auth/captcha-check-failed":
        return "Security verification failed. Refresh the page and try again.";
      default:
        return error.message || "Authentication failed. Please try again.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
}

export async function registerWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function logout(): Promise<void> {
  await signOut(getFirebaseAuth());
  clearAuthSessionCookie();
  clearAppRoleCookie();
  clearActorUserCookie();
  clearWorkspaceCookies();
  resetFirebaseAuthReadyState();
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (!email.trim()) {
    throw new Error("Please enter your email address.");
  }

  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

export const RECAPTCHA_CONTAINER_ID = "recaptcha-container";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

function assertRecaptchaContainerMounted(containerId: string): void {
  if (typeof document === "undefined") {
    throw new Error("reCAPTCHA is only available in the browser.");
  }

  const container = document.getElementById(containerId);

  if (!container) {
    throw new Error(
      `reCAPTCHA container #${containerId} is not mounted in the DOM.`
    );
  }
}

export function clearInvisibleRecaptcha(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.recaptchaVerifier?.clear();
  } catch {
    // The container may already be gone during route transitions.
  }

  window.recaptchaVerifier = undefined;
}

export function getOrCreateInvisibleRecaptcha(
  containerId: string = RECAPTCHA_CONTAINER_ID
): RecaptchaVerifier {
  assertRecaptchaContainerMounted(containerId);

  if (window.recaptchaVerifier) {
    return window.recaptchaVerifier;
  }

  window.recaptchaVerifier = new RecaptchaVerifier(
    getFirebaseAuth(),
    containerId,
    {
      size: "invisible",
    }
  );

  return window.recaptchaVerifier;
}

/** @deprecated Use getOrCreateInvisibleRecaptcha() for singleton-safe initialization. */
export function createInvisibleRecaptcha(containerId: string): RecaptchaVerifier {
  return getOrCreateInvisibleRecaptcha(containerId);
}

export async function sendPhoneOtp(
  user: User,
  mobileDigits: string,
  recaptchaVerifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  if (!isValidIndianMobileNumber(mobileDigits)) {
    throw new Error("Enter a valid 10-digit Indian mobile number.");
  }

  const phoneNumber = formatIndianMobileNumber(mobileDigits);
  return linkWithPhoneNumber(user, phoneNumber, recaptchaVerifier);
}

export async function verifyPhoneOtp(
  confirmationResult: ConfirmationResult,
  otpCode: string
): Promise<UserCredential> {
  return confirmationResult.confirm(otpCode);
}

export async function syncUserToSupabase(user: User): Promise<RecoverpeUser> {
  const idToken = await user.getIdToken(true);

  const response = await fetch("/api/users/sync", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
  });

  const payload = await parseApiJsonResponse<{ user?: RecoverpeUser }>(response);

  if (!payload.user) {
    throw new Error("Failed to sync your account.");
  }

  return payload.user;
}

export function userNeedsMobileVerification(user: User | null): boolean {
  return Boolean(user && !user.phoneNumber);
}
