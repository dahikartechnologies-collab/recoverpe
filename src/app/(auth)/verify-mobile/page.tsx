"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  createInvisibleRecaptcha,
  getFirebaseAuth,
  getFirebaseAuthErrorMessage,
  sendPhoneOtp,
  syncUserToSupabase,
  userNeedsMobileVerification,
  verifyPhoneOtp,
} from "@/lib/auth";

export default function VerifyMobilePage() {
  const router = useRouter();
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [mobileDigits, setMobileDigits] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      if (!userNeedsMobileVerification(user)) {
        try {
          await syncUserToSupabase(user);
          router.replace("/dashboard");
        } catch (syncError) {
          setError(getFirebaseAuthErrorMessage(syncError));
          setIsCheckingAuth(false);
        }
        return;
      }

      setCurrentUser(user);
      setIsCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!currentUser) {
      setError("Please register or log in before verifying your mobile number.");
      return;
    }

    setIsSendingOtp(true);

    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = createInvisibleRecaptcha("recaptcha-container");
      }

      confirmationRef.current = await sendPhoneOtp(
        currentUser,
        mobileDigits.trim(),
        recaptchaRef.current
      );
      setOtpSent(true);
    } catch (sendError) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      setError(getFirebaseAuthErrorMessage(sendError));
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!confirmationRef.current) {
      setError("Please request an OTP first.");
      return;
    }

    setIsVerifying(true);

    try {
      const credential = await verifyPhoneOtp(
        confirmationRef.current,
        otpCode.trim()
      );

      await syncUserToSupabase(credential.user);
      router.push("/dashboard");
    } catch (verifyError) {
      setError(getFirebaseAuthErrorMessage(verifyError));
    } finally {
      setIsVerifying(false);
    }
  }

  if (isCheckingAuth) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-recoverpe-grey-medium">
            Checking your session...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <h1 className="text-2xl font-semibold text-recoverpe-black">
          Verify your mobile number
        </h1>
        <p className="mt-2 text-sm text-recoverpe-grey-medium">
          Step 2 of 2: Indian numbers only (+91). We will send a 6-digit OTP via
          SMS.
        </p>

        {!otpSent ? (
          <form className="mt-6 space-y-4" onSubmit={handleSendOtp}>
            <div>
              <label
                htmlFor="mobile"
                className="mb-1.5 block text-sm font-medium text-recoverpe-black"
              >
                Mobile number
              </label>
              <div className="flex overflow-hidden rounded-md border border-recoverpe-grey-light focus-within:border-recoverpe-black">
                <span className="flex items-center border-r border-recoverpe-grey-light bg-recoverpe-grey-light px-3 text-sm font-medium text-recoverpe-black">
                  +91
                </span>
                <Input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  value={mobileDigits}
                  onChange={(event) =>
                    setMobileDigits(event.target.value.replace(/\D/g, ""))
                  }
                  className="rounded-none border-0 focus:border-0"
                  required
                />
              </div>
            </div>

            <div id="recaptcha-container" />

            {error ? (
              <p className="text-sm text-recoverpe-error">{error}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSendingOtp}>
              {isSendingOtp ? "Sending OTP..." : "Send OTP"}
            </Button>
          </form>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleVerifyOtp}>
            <div>
              <label
                htmlFor="otp"
                className="mb-1.5 block text-sm font-medium text-recoverpe-black"
              >
                6-digit OTP
              </label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter OTP"
                maxLength={6}
                value={otpCode}
                onChange={(event) =>
                  setOtpCode(event.target.value.replace(/\D/g, ""))
                }
                required
              />
            </div>

            {error ? (
              <p className="text-sm text-recoverpe-error">{error}</p>
            ) : null}

            <Button type="submit" className="w-full" disabled={isVerifying}>
              {isVerifying ? "Verifying..." : "Verify and continue"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                setOtpSent(false);
                setOtpCode("");
                setError("");
                confirmationRef.current = null;
                recaptchaRef.current?.clear();
                recaptchaRef.current = null;
              }}
            >
              Change mobile number
            </Button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-recoverpe-grey-medium">
          Need to use a different email?{" "}
          <Link href="/login" className="font-medium text-recoverpe-black underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
