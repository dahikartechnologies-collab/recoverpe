"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/auth/PasswordInput";
import {
  getFirebaseAuthErrorMessage,
  loginWithEmail,
  syncUserToSupabase,
  userNeedsMobileVerification,
} from "@/lib/auth";
import { setActorUserCookie } from "@/lib/auth-cookies";
import {
  fetchWorkspaceRole,
  getPostLoginRoute,
  setAppRoleCookie,
} from "@/lib/kiosk-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const credential = await loginWithEmail(email.trim(), password);

      if (userNeedsMobileVerification(credential.user)) {
        router.push("/verify-mobile");
        return;
      }

      const syncedUser = await syncUserToSupabase(credential.user);
      setActorUserCookie(syncedUser.id);
      const roleContext = await fetchWorkspaceRole();
      setAppRoleCookie(roleContext.role);
      router.push(getPostLoginRoute(roleContext.role));
    } catch (submitError) {
      setError(getFirebaseAuthErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <h1 className="text-2xl font-semibold text-recoverpe-black">Sign in</h1>
        <p className="mt-2 text-sm text-recoverpe-grey-medium">
          Returning users sign in with email and password. No OTP required.
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

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-recoverpe-black"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-recoverpe-black underline"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="text-sm text-recoverpe-error">{error}</p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-recoverpe-grey-medium">
          New to Recoverpe?{" "}
          <Link
            href="/register"
            className="font-medium text-recoverpe-black underline"
          >
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
