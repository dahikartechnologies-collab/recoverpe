"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  getFirebaseAuthErrorMessage,
  sendPasswordReset,
} from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      await sendPasswordReset(email.trim());
      setSuccessMessage(
        "If an account exists for this email, a password reset link has been sent. Check your inbox."
      );
    } catch (submitError) {
      setError(getFirebaseAuthErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <h1 className="text-2xl font-semibold text-recoverpe-black">
          Reset password
        </h1>
        <p className="mt-2 text-sm text-recoverpe-grey-medium">
          Enter your account email and we will send a secure reset link.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-recoverpe-black"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@business.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}
          {successMessage ? (
            <p className="text-sm text-recoverpe-success">{successMessage}</p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send reset link"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-recoverpe-grey-medium">
          Remembered your password?{" "}
          <Link href="/login" className="font-medium text-recoverpe-black underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
