"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { testAdminNotifications } from "@/lib/admin-client";

export function AdminOmnichannelDiagnosticsCard() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [responseJson, setResponseJson] = useState<string>("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResponseJson("");
    setIsSubmitting(true);

    try {
      const result = await testAdminNotifications({
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      setResponseJson(JSON.stringify(result, null, 2));
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Notification diagnostics failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-recoverpe-black">
          Test Omnichannel Dispatcher
        </h2>
        <p className="mt-1 text-sm text-recoverpe-grey-medium">
          Send sample overdue reminder email and SMS payloads to monitor Resend
          delivery and Fast2SMS DLT approval status.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void handleSubmit(event)}>
          <div>
            <label
              htmlFor="diagnostics-email"
              className="mb-1.5 block text-sm font-medium text-recoverpe-black"
            >
              Email
            </label>
            <Input
              id="diagnostics-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="founder@recoverpe.com"
            />
          </div>
          <div>
            <label
              htmlFor="diagnostics-phone"
              className="mb-1.5 block text-sm font-medium text-recoverpe-black"
            >
              Phone number
            </label>
            <Input
              id="diagnostics-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="9876543210"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending test payloads..." : "Run diagnostics"}
            </Button>
          </div>
        </form>

        {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

        {responseJson ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-recoverpe-black">Raw response</p>
            <pre className="max-h-[420px] overflow-auto rounded-md border border-recoverpe-grey-light bg-recoverpe-grey-light/20 p-4 text-xs leading-5 text-recoverpe-black">
              {responseJson}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
