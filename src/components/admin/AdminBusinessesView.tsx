"use client";

import { FormEvent, useState } from "react";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Toast } from "@/components/ui/Toast";
import {
  grantAdminBusinessTier,
} from "@/lib/admin-client";
import { trackMetaEvent } from "@/lib/analytics-events";
import { AdminManagedBusiness, Tier } from "@/types";
import { Building2, Crown } from "lucide-react";

interface AdminBusinessesViewProps {
  initialBusinesses: AdminManagedBusiness[];
}

interface ToastState {
  message: string;
  variant: "success" | "error";
}

type GrantTier = Extract<Tier, "business" | "premium">;
type DurationPreset = "7" | "30" | "365" | "custom";

function tierTone(tier: AdminManagedBusiness["subscription_tier"]): BadgeTone {
  switch (tier) {
    case "premium":
      return "success";
    case "business":
      return "warning";
    case "starter":
    case "free":
      return "neutral";
    default:
      return "neutral";
  }
}

function formatTierLabel(tier: AdminManagedBusiness["subscription_tier"]): string {
  if (tier === "free") {
    return "Starter";
  }

  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function resolveGrantDays(
  preset: DurationPreset,
  customDate: string
): number | null {
  if (preset === "7") {
    return 7;
  }

  if (preset === "30") {
    return 30;
  }

  if (preset === "365") {
    return 365;
  }

  if (!customDate) {
    return null;
  }

  const expiresAt = new Date(`${customDate}T23:59:59.999Z`);
  const now = new Date();

  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    return null;
  }

  return Math.max(
    1,
    Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );
}

export function AdminBusinessesView({
  initialBusinesses,
}: AdminBusinessesViewProps) {
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingBusinessId, setPendingBusinessId] = useState<string | null>(null);
  const [grantTarget, setGrantTarget] = useState<AdminManagedBusiness | null>(null);
  const [grantTier, setGrantTier] = useState<GrantTier>("business");
  const [durationPreset, setDurationPreset] = useState<DurationPreset>("30");
  const [customExpiryDate, setCustomExpiryDate] = useState("");

  function openGrantModal(business: AdminManagedBusiness) {
    setGrantTarget(business);
    setGrantTier("business");
    setDurationPreset("30");
    setCustomExpiryDate("");
  }

  async function handleGrantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!grantTarget) {
      return;
    }

    const days = resolveGrantDays(durationPreset, customExpiryDate);

    if (!days) {
      setToast({
        message: "Choose a valid duration or a future calendar expiry date.",
        variant: "error",
      });
      return;
    }

    setPendingBusinessId(grantTarget.id);
    setToast(null);

    try {
      const result = await grantAdminBusinessTier(grantTarget.id, {
        tier: grantTier,
        days,
      });

      trackMetaEvent("Subscribe", {
        currency: "INR",
        value: 0,
        content_name: "Admin Granted",
      });

      setBusinesses((current) =>
        current.map((business) =>
          business.id === grantTarget.id ? result.business : business
        )
      );
      setGrantTarget(null);
      setToast({ message: result.message, variant: "success" });
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : "Failed to grant tier access.",
        variant: "error",
      });
    } finally {
      setPendingBusinessId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business God Mode"
        description="Grant Business or Premium access without Razorpay billing. Expired grants automatically downgrade to Starter entitlements."
      />

      <Card>
        <CardContent className="pt-6">
          {businesses.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-5 w-5" aria-hidden />}
              title="No businesses found"
              description="Business workspaces will appear here once merchants onboard."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {businesses.map((business) => (
                  <TableRow key={business.id}>
                    <TableCell className="font-medium text-recoverpe-black">
                      {business.business_name}
                    </TableCell>
                    <TableCell className="text-recoverpe-muted">
                      {business.owner_email}
                    </TableCell>
                    <TableCell>
                      <Badge tone={tierTone(business.subscription_tier)}>
                        {formatTierLabel(business.subscription_tier)}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-recoverpe-muted">
                      {business.subscription_status ?? "none"}
                    </TableCell>
                    <TableCell className="tabular-nums text-recoverpe-muted">
                      {formatDateTime(business.subscription_expires_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pendingBusinessId === business.id}
                        onClick={() => openGrantModal(business)}
                      >
                        <Crown className="h-4 w-4" aria-hidden />
                        Grant Tier Access
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={Boolean(grantTarget)}
        onClose={() => setGrantTarget(null)}
        title="Grant Tier Access"
      >
        {grantTarget ? (
          <form className="space-y-4" onSubmit={(event) => void handleGrantSubmit(event)}>
            <p className="text-sm text-recoverpe-muted">
              Grant temporary access for{" "}
              <span className="font-medium text-recoverpe-black">
                {grantTarget.business_name}
              </span>
              . Any active Razorpay subscription will be cancelled to prevent double billing.
            </p>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-recoverpe-black">
                Tier
              </label>
              <select
                className="w-full rounded-lg border border-recoverpe-line bg-recoverpe-white px-3 py-2 text-sm"
                value={grantTier}
                onChange={(event) =>
                  setGrantTier(event.target.value as GrantTier)
                }
              >
                <option value="business">Business — 60 AI minutes, advanced Khata</option>
                <option value="premium">Premium — 300 AI minutes, all features</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-recoverpe-black">
                Duration
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "7", label: "7 Days" },
                  { id: "30", label: "30 Days" },
                  { id: "365", label: "1 Year" },
                  { id: "custom", label: "Calendar Date" },
                ].map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    size="sm"
                    variant={durationPreset === option.id ? "primary" : "secondary"}
                    onClick={() => setDurationPreset(option.id as DurationPreset)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {durationPreset === "custom" ? (
              <div>
                <label
                  htmlFor="customExpiryDate"
                  className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                >
                  Expiry date
                </label>
                <Input
                  id="customExpiryDate"
                  type="date"
                  value={customExpiryDate}
                  onChange={(event) => setCustomExpiryDate(event.target.value)}
                  required
                />
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setGrantTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pendingBusinessId === grantTarget.id}
              >
                {pendingBusinessId === grantTarget.id
                  ? "Granting…"
                  : "Grant Access"}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

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
