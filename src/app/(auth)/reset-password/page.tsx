"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordRequirements } from "@/components/auth/PasswordRequirements";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import {
  completePasswordReset,
  getFirebaseAuthErrorMessage,
} from "@/lib/auth";
import {
  getResetPasswordValidationMessage,
  isResetPasswordValid,
} from "@/lib/password-policy";

type ToastState = {
  message: string;
  variant: "success" | "error";
} | null;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  if (!oobCode) {
    return (
      <Card>
        <CardContent>
          <h1 className="text-2xl font-semibold text-recoverpe-black">
            Invalid reset link
          </h1>
          <p className="mt-2 text-sm text-recoverpe-error">
            This password reset link is missing a verification code. Request a
            new link and try again.
          </p>
          <div className="mt-6 space-y-3">
            <Link
              href="/forgot-password"
              className="focus-ring rp-press inline-flex h-10 w-full items-center justify-center rounded-md border border-recoverpe-black bg-recoverpe-black px-4 text-sm font-medium text-recoverpe-white hover:bg-recoverpe-grey-medium"
            >
              Request new reset link
            </Link>
            <Link
              href="/login"
              className="focus-ring rp-press inline-flex h-10 w-full items-center justify-center rounded-md border border-recoverpe-line-strong bg-recoverpe-white px-4 text-sm font-medium text-recoverpe-black hover:bg-recoverpe-fill"
            >
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setToast(null);

    if (!isResetPasswordValid(password)) {
      setError(
        getResetPasswordValidationMessage(password) ??
          "Password does not meet the security requirements."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await completePasswordReset(oobCode, password);
      setToast({
        variant: "success",
        message: "Password updated. Redirecting you to sign in...",
      });
      window.setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (submitError) {
      const message = getFirebaseAuthErrorMessage(submitError);
      setError(message);
      setToast({
        variant: "error",
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Card>
        <CardContent>
          <h1 className="text-2xl font-semibold text-recoverpe-black">
            Set new password
          </h1>
          <p className="mt-2 text-sm text-recoverpe-grey-medium">
            Choose a secure password for your Recoverpe account.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-recoverpe-black"
              >
                New password
              </label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                placeholder="Create a secure password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <PasswordRequirements password={password} mode="reset" />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-sm font-medium text-recoverpe-black"
              >
                Confirm password
              </label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>

            {error ? (
              <p className="text-sm text-recoverpe-error">{error}</p>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !isResetPasswordValid(password)}
            >
              {isSubmitting ? "Updating password..." : "Update password"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-recoverpe-grey-medium">
            Link expired?{" "}
            <Link
              href="/forgot-password"
              className="font-medium text-recoverpe-black underline"
            >
              Request a new reset email
            </Link>
          </p>
        </CardContent>
      </Card>

      {toast ? (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      ) : null}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent>
            <p className="text-sm text-recoverpe-grey-medium">
              Loading reset form...
            </p>
          </CardContent>
        </Card>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
