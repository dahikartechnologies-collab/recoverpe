"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { PremiumToggleCard } from "@/components/dashboard/settings/PremiumToggleCard";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  fetchBusinesses,
  updateBusinessSettings,
} from "@/lib/businesses";
import {
  DEFAULT_AUTOPILOT_SCHEDULE,
  formatAutopilotScheduleLabel,
  parseAutopilotSchedule,
  resolveAutopilotSchedule,
} from "@/lib/autopilot-schedule";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_SMTP_SETTINGS,
  parseNotificationPreferences,
  parseSmtpSettings,
} from "@/lib/notification-settings";
import { sendSmtpTestEmail } from "@/lib/notification-settings-client";
import { fetchCurrentUser } from "@/lib/users";
import { useWorkspaceStore } from "@/store/workspace-store";
import {
  BusinessNotificationPreferences,
  BusinessSmtpSettings,
} from "@/types";

export function NotificationSettingsView() {
  const router = useRouter();
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const subscriptionPlan = useWorkspaceStore((state) => state.subscriptionPlan);
  const setBusinesses = useWorkspaceStore((state) => state.setBusinesses);

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [autopilotScheduleInput, setAutopilotScheduleInput] = useState(
    DEFAULT_AUTOPILOT_SCHEDULE.join(", ")
  );
  const [preferences, setPreferences] = useState<BusinessNotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [smtpSettings, setSmtpSettings] =
    useState<BusinessSmtpSettings>(DEFAULT_SMTP_SETTINGS);
  const [testRecipient, setTestRecipient] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [businesses, user] = await Promise.all([
        fetchBusinesses(),
        fetchCurrentUser(),
      ]);

      const selectedBusiness =
        businesses.find((business) => business.id === activeBusinessId) ??
        businesses[0] ??
        null;

      if (!selectedBusiness) {
        setError("Create a business profile before configuring notifications.");
        return;
      }

      setBusinessId(selectedBusiness.id);
      setBusinessName(selectedBusiness.business_name);
      const resolvedSchedule = resolveAutopilotSchedule(
        user.subscription_plan,
        selectedBusiness
      );
      setAutopilotScheduleInput(resolvedSchedule.join(", "));
      setPreferences(
        parseNotificationPreferences(selectedBusiness.notification_preferences)
      );
      setSmtpSettings(parseSmtpSettings(selectedBusiness.smtp_settings));
      setTestRecipient(user.email);
      setBusinesses(businesses);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load notification settings."
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeBusinessId, setBusinesses]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!businessId) {
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const scheduleValues = autopilotScheduleInput
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value));

      await updateBusinessSettings(businessId, {
        notification_preferences: preferences,
        smtp_settings: smtpSettings,
        ...(subscriptionPlan === "premium"
          ? { autopilot_schedule: scheduleValues }
          : {}),
      });
      setSuccessMessage("Notification settings saved.");
      await loadSettings();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save notification settings."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestEmail() {
    if (!businessId) {
      return;
    }

    setIsTesting(true);
    setError("");
    setSuccessMessage("");

    try {
      const result = await sendSmtpTestEmail({
        businessId,
        recipientEmail: testRecipient,
        smtpSettings,
      });

      setSuccessMessage(
        result.simulated
          ? "SMTP test simulated in development mode."
          : result.message
      );
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message
          : "SMTP test failed."
      );
    } finally {
      setIsTesting(false);
    }
  }

  if (isLoading) {
    return (
      <p className="text-sm text-recoverpe-grey-medium">
        Loading notification settings...
      </p>
    );
  }

  if (error && !businessId) {
    return <p className="text-sm text-recoverpe-error">{error}</p>;
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div>
        <h1 className="text-2xl font-semibold text-recoverpe-black">
          Notification Channels & Email Setup
        </h1>
        <p className="mt-1 text-sm text-recoverpe-grey-medium">
          Configure WhatsApp reminders and zero-cost outbound email for{" "}
          <span className="font-medium text-recoverpe-black">{businessName}</span>.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-recoverpe-grey-light px-5 py-4">
          <h2 className="text-base font-semibold text-recoverpe-black">
            Channel preferences
          </h2>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          <PremiumToggleCard
            checked={preferences.whatsapp_enabled}
            onChange={(value) =>
              setPreferences((current) => ({ ...current, whatsapp_enabled: value }))
            }
            icon={MessageCircle}
            title="WhatsApp reminders"
            description="Send payment reminders and legal notices through Meta WhatsApp when available."
          />
          <PremiumToggleCard
            checked={preferences.email_enabled}
            onChange={(value) =>
              setPreferences((current) => ({ ...current, email_enabled: value }))
            }
            icon={Mail}
            title="Email notifications"
            description="Allow outbound email using your business SMTP mailbox."
          />
          <PremiumToggleCard
            checked={preferences.auto_fallback}
            onChange={(value) =>
              setPreferences((current) => ({ ...current, auto_fallback: value }))
            }
            icon={ShieldCheck}
            title="Auto-fallback to email"
            description="Automatically route to SMTP email when WhatsApp is disabled, rate-limited, or unavailable."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-recoverpe-grey-light px-5 py-4">
          <h2 className="text-base font-semibold text-recoverpe-black">
            Autopilot Schedule
          </h2>
          <p className="mt-1 text-xs text-recoverpe-grey-medium">
            Automated WhatsApp recovery cadence relative to each invoice due date.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="rounded-md border border-recoverpe-grey-light px-4 py-3">
            <p className="text-sm font-medium text-recoverpe-black">
              {formatAutopilotScheduleLabel(
                resolveAutopilotSchedule(subscriptionPlan, {
                  autopilot_schedule: parseAutopilotSchedule(
                    autopilotScheduleInput
                      .split(",")
                      .map((value) => Number(value.trim()))
                  ),
                })
              )}
            </p>
            <p className="mt-1 text-xs text-recoverpe-grey-medium">
              Free plan: Day 0, Day 3, Day 5, Day 7 (locked). Premium can customize
              offsets.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-recoverpe-black">
              Day offsets (comma-separated)
            </label>
            <Input
              value={autopilotScheduleInput}
              onChange={(event) => setAutopilotScheduleInput(event.target.value)}
              placeholder="0, 3, 5, 7"
              disabled={subscriptionPlan !== "premium"}
            />
          </div>

          {subscriptionPlan !== "premium" ? (
            <Button
              type="button"
              variant="secondary"
              className="inline-flex items-center gap-2"
              onClick={() => router.push("/dashboard/billing")}
            >
              <Lock className="h-4 w-4" aria-hidden />
              Upgrade to Premium to customize schedule
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-recoverpe-grey-light px-5 py-4">
          <h2 className="text-base font-semibold text-recoverpe-black">
            Custom outbound email (SMTP)
          </h2>
          <p className="mt-1 text-xs text-recoverpe-grey-medium">
            Use Gmail App Password, Zoho Mail, or your own SMTP server. No paid email SDK required.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-recoverpe-black">
              SMTP host
            </label>
            <Input
              value={smtpSettings.host}
              onChange={(event) =>
                setSmtpSettings((current) => ({
                  ...current,
                  host: event.target.value,
                }))
              }
              placeholder="smtp.gmail.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-recoverpe-black">
              Port
            </label>
            <Input
              type="number"
              value={smtpSettings.port}
              onChange={(event) =>
                setSmtpSettings((current) => ({
                  ...current,
                  port: Number(event.target.value) || 587,
                }))
              }
              placeholder="587"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-recoverpe-black">
              Username / email
            </label>
            <Input
              value={smtpSettings.user}
              onChange={(event) =>
                setSmtpSettings((current) => ({
                  ...current,
                  user: event.target.value,
                }))
              }
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-recoverpe-black">
              Password / app password
            </label>
            <Input
              type="password"
              value={smtpSettings.pass}
              onChange={(event) =>
                setSmtpSettings((current) => ({
                  ...current,
                  pass: event.target.value,
                }))
              }
              placeholder="Leave blank to keep saved password"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-recoverpe-black">
              Sender display name
            </label>
            <Input
              value={smtpSettings.from_name}
              onChange={(event) =>
                setSmtpSettings((current) => ({
                  ...current,
                  from_name: event.target.value,
                }))
              }
              placeholder="Acme Collections Desk"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-recoverpe-black">
              Sender email address
            </label>
            <Input
              type="email"
              value={smtpSettings.from_email}
              onChange={(event) =>
                setSmtpSettings((current) => ({
                  ...current,
                  from_email: event.target.value,
                }))
              }
              placeholder="collections@company.com"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm text-recoverpe-black">
              <input
                type="checkbox"
                checked={smtpSettings.secure}
                onChange={(event) =>
                  setSmtpSettings((current) => ({
                    ...current,
                    secure: event.target.checked,
                  }))
                }
              />
              Use SSL/TLS (port 465)
            </label>
          </div>
          <div className="sm:col-span-2 flex flex-col gap-3 border-t border-recoverpe-grey-light pt-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-recoverpe-black">
                Test recipient email
              </label>
              <Input
                type="email"
                value={testRecipient}
                onChange={(event) => setTestRecipient(event.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={isTesting || !testRecipient.trim()}
              onClick={() => void handleTestEmail()}
            >
              {isTesting ? "Sending..." : "Send Test Email"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}
      {successMessage ? (
        <p className="text-sm text-[#059669]">{successMessage}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save notification settings"}
        </Button>
      </div>
    </form>
  );
}
