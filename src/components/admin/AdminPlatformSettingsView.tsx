"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import {
  fetchAdminPlatformSettings,
  updateAdminPlatformSettings,
} from "@/lib/admin-client";
import { PlatformSettings } from "@/lib/platform-settings";
import { Settings2 } from "lucide-react";

interface ToastState {
  message: string;
  variant: "success" | "error";
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AdminPlatformSettingsView() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [marginInput, setMarginInput] = useState("");
  const [bufferInput, setBufferInput] = useState("");
  const [fallbackInput, setFallbackInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setError("");

      try {
        const payload = await fetchAdminPlatformSettings();
        setSettings(payload.settings);
        setMarginInput(String(payload.settings.vapi_margin_percentage));
        setBufferInput(String(payload.settings.fx_risk_buffer_percentage));
        setFallbackInput(String(payload.settings.fallback_usd_to_inr));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load platform settings."
        );
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const payload = await updateAdminPlatformSettings({
        vapi_margin_percentage: Number(marginInput),
        fx_risk_buffer_percentage: Number(bufferInput),
        fallback_usd_to_inr: Number(fallbackInput),
      });

      setSettings(payload.settings);
      setMarginInput(String(payload.settings.vapi_margin_percentage));
      setBufferInput(String(payload.settings.fx_risk_buffer_percentage));
      setFallbackInput(String(payload.settings.fallback_usd_to_inr));
      setToast({
        message: "Platform economics updated.",
        variant: "success",
      });
    } catch (saveError) {
      setToast({
        message:
          saveError instanceof Error
            ? saveError.message
            : "Failed to update platform settings.",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Platform Economics"
        description="Control AI voice FX buffer, fallback exchange rates, and profit margin without redeploying code."
      />

      {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}

      {isLoading ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : (
        <Card>
          <CardContent className="space-y-6 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-recoverpe-line bg-recoverpe-fill text-recoverpe-black">
                <Settings2 className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-recoverpe-black">
                  Live billing formula
                </p>
                <p className="mt-1 text-sm text-recoverpe-muted">
                  Margin is the pure profit added after the FX Risk Buffer is
                  applied to the live USD cost.
                </p>
                <p className="mt-2 rounded-lg border border-recoverpe-line bg-recoverpe-fill px-3 py-2 font-mono text-xs text-recoverpe-black">
                  billed = (vapi_usd × live_inr × (1 + buffer%)) × (1 + margin%)
                </p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label
                    htmlFor="vapiMarginPercentage"
                    className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                  >
                    VAPI Margin (%)
                  </label>
                  <Input
                    id="vapiMarginPercentage"
                    type="number"
                    min={0}
                    max={200}
                    step={0.1}
                    value={marginInput}
                    onChange={(event) => setMarginInput(event.target.value)}
                    required
                  />
                  <p className="mt-1 text-xs text-recoverpe-muted">
                    Profit added on top of buffered provider cost.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="fxRiskBufferPercentage"
                    className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                  >
                    FX Risk Buffer (%)
                  </label>
                  <Input
                    id="fxRiskBufferPercentage"
                    type="number"
                    min={0}
                    max={50}
                    step={0.1}
                    value={bufferInput}
                    onChange={(event) => setBufferInput(event.target.value)}
                    required
                  />
                  <p className="mt-1 text-xs text-recoverpe-muted">
                    Cushion applied to the live USD/INR rate before billing.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="fallbackUsdToInr"
                    className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                  >
                    Fallback USD/INR
                  </label>
                  <Input
                    id="fallbackUsdToInr"
                    type="number"
                    min={1}
                    max={500}
                    step={0.01}
                    value={fallbackInput}
                    onChange={(event) => setFallbackInput(event.target.value)}
                    required
                  />
                  <p className="mt-1 text-xs text-recoverpe-muted">
                    Used when the live FX API is unavailable.
                  </p>
                </div>
              </div>

              {settings ? (
                <p className="text-xs text-recoverpe-muted">
                  Last updated {formatDateTime(settings.updated_at)}
                </p>
              ) : null}

              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving…" : "Save Platform Economics"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {toast ? (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
