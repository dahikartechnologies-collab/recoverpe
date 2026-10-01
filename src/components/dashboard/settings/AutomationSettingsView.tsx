"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Network, ReceiptText } from "lucide-react";
import { PremiumToggleCard } from "@/components/dashboard/settings/PremiumToggleCard";
import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { AutomationSettingKey, DEFAULT_AUTOMATION_SETTINGS } from "@/lib/automation-settings";
import {
  AutomationSettingsError,
  fetchAutomationSettings,
  updateAutomationSettings,
} from "@/lib/automation-settings-client";
import { useWorkspaceStore } from "@/store/workspace-store";
import { BusinessAutomationSettings } from "@/types";

const TOGGLES: Array<{
  key: AutomationSettingKey;
  title: string;
  description: string;
  icon: typeof BellRing;
  footnote?: string;
}> = [
  {
    key: "recovery_autopilot",
    title: "Recovery Autopilot",
    description: "Automatically send payment reminders to debtors.",
    icon: BellRing,
    footnote:
      "When off, scheduled reminders pause and resume from the same step once you turn it back on. Messages you send manually are not affected.",
  },
  {
    key: "smart_stocks_receipts",
    title: "Smart Stocks Receipts",
    description: "Automatically send WhatsApp invoices on voice checkout.",
    icon: ReceiptText,
    footnote: "When off, voice sales still post to stock and khata without messaging the customer.",
  },
  {
    key: "b2b_network",
    title: "B2B Network",
    description: "Share anonymous dead-stock data to nearby merchants.",
    icon: Network,
    footnote: "Opt-in and off by default. Nothing is shared until the B2B Network launches.",
  },
];

export function AutomationSettingsView() {
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const businesses = useWorkspaceStore((state) => state.businesses);
  const businessId = activeBusinessId ?? businesses[0]?.id ?? null;
  const businessName =
    businesses.find((business) => business.id === businessId)?.business_name ?? "";

  const [settings, setSettings] = useState<BusinessAutomationSettings>(
    DEFAULT_AUTOMATION_SETTINGS
  );
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<AutomationSettingKey | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!businessId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetchAutomationSettings(businessId);
      setSettings(response.automation_settings);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load automation settings."
      );
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggle(key: AutomationSettingKey, value: boolean) {
    if (!businessId || savingKey) {
      return;
    }

    const previous = settings;
    setSettings({ ...settings, [key]: value });
    setSavingKey(key);
    setError("");
    setNotice("");

    try {
      const response = await updateAutomationSettings(businessId, { [key]: value });
      setSettings(response.automation_settings);
      const label = TOGGLES.find((toggle) => toggle.key === key)?.title ?? "Setting";
      setNotice(`${label} turned ${value ? "on" : "off"}.`);
    } catch (saveError) {
      setSettings(previous);
      setError(
        saveError instanceof AutomationSettingsError || saveError instanceof Error
          ? saveError.message
          : "Failed to save automation settings."
      );
    } finally {
      setSavingKey(null);
    }
  }

  if (!businessId) {
    return (
      <p className="text-sm text-recoverpe-grey-medium">
        Create a business profile before configuring automations.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-recoverpe-black">Automation &amp; AI</h1>
        <p className="mt-1 text-sm text-recoverpe-grey-medium">
          Every automated action Recoverpe takes for{" "}
          <span className="font-medium text-recoverpe-black">{businessName || "this business"}</span>
          . Switch any of them off at any time; changes apply to the next scheduled run.
        </p>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <Card>
        <CardHeader className="border-b border-recoverpe-grey-light px-5 py-4">
          <h2 className="text-base font-semibold text-recoverpe-black">Automations</h2>
          <p className="mt-1 text-xs text-recoverpe-grey-medium">
            Every WhatsApp message these send is logged with its exact text and delivery status in
            each customer&apos;s Communication History.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          {TOGGLES.map((toggle) => (
            <div key={toggle.key} className={isLoading ? "pointer-events-none opacity-60" : ""}>
              <PremiumToggleCard
                checked={settings[toggle.key]}
                onChange={(value) => void handleToggle(toggle.key, value)}
                icon={toggle.icon}
                title={
                  savingKey === toggle.key ? `${toggle.title} (saving...)` : toggle.title
                }
                description={toggle.description}
              />
              {toggle.footnote ? (
                <p className="mt-2 px-1 text-xs leading-relaxed text-recoverpe-grey-medium">
                  {toggle.footnote}
                </p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
