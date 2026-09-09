"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  fetchBusinesses,
  updateBusinessSettings,
} from "@/lib/businesses";
import { fetchWorkspaceRole } from "@/lib/kiosk-client";
import { canEditBusinessSettings } from "@/lib/workspace-permissions";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Business } from "@/types";

export function BusinessProfileView() {
  const activeBusinessId = useWorkspaceStore((state) => state.activeBusinessId);
  const isOwnWorkspaceContext = useWorkspaceStore(
    (state) => state.isOwnWorkspaceContext
  );
  const setBusinesses = useWorkspaceStore((state) => state.setBusinesses);
  const setCustomPermissions = useWorkspaceStore((state) => state.setCustomPermissions);
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const roleContext = await fetchWorkspaceRole();
      setCustomPermissions(roleContext.custom_permissions);

      if (!canEditBusinessSettings(roleContext.role, roleContext.custom_permissions)) {
        setError("You do not have permission to edit business profile settings.");
        setBusiness(null);
        return;
      }

      const businesses = await fetchBusinesses();
      const selectedBusiness =
        businesses.find((entry) => entry.id === activeBusinessId) ??
        businesses[0] ??
        null;

      if (!selectedBusiness) {
        setError("Create a business profile before editing business settings.");
        return;
      }

      setBusiness(selectedBusiness);
      setBusinessName(selectedBusiness.business_name);
      setBusinessAddress(selectedBusiness.business_address ?? "");
      setGstin(selectedBusiness.gstin ?? "");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load business profile."
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeBusinessId, isOwnWorkspaceContext, setCustomPermissions]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!business) {
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const updatedBusiness = await updateBusinessSettings(business.id, {
        business_name: businessName,
        business_address: businessAddress,
        gstin,
      });

      setBusiness(updatedBusiness);
      const businesses = await fetchBusinesses();
      setBusinesses(businesses);
      setSuccessMessage("Business profile saved. Legal dockets will use these details.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save business profile."
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!isLoading && error && !business) {
    return (
      <Card>
        <CardContent className="space-y-4 py-8 text-center">
          <p className="text-sm text-recoverpe-error">{error}</p>
          <Link
            href="/dashboard/settings"
            className="text-sm font-medium text-recoverpe-black underline"
          >
            Back to settings
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-recoverpe-black">
          Business Profile
        </h1>
        <p className="mt-1 text-sm text-recoverpe-grey-medium">
          Official merchant details used on legal dockets and tax documents.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-recoverpe-black">
            {business?.business_name || "Business details"}
          </h2>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-recoverpe-grey-medium">Loading profile...</p>
          ) : (
            <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
              <div>
                <label
                  htmlFor="business-name"
                  className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                >
                  Business name
                </label>
                <Input
                  id="business-name"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="business-address"
                  className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                >
                  Address
                </label>
                <textarea
                  id="business-address"
                  value={businessAddress}
                  onChange={(event) => setBusinessAddress(event.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2.5 text-sm text-recoverpe-black outline-none transition-colors placeholder:text-recoverpe-grey-medium focus:border-recoverpe-black"
                  placeholder="Registered office address"
                />
              </div>

              <div>
                <label
                  htmlFor="business-gstin"
                  className="mb-1.5 block text-sm font-medium text-recoverpe-black"
                >
                  GSTIN
                </label>
                <Input
                  id="business-gstin"
                  value={gstin}
                  onChange={(event) => setGstin(event.target.value.toUpperCase())}
                  placeholder="15-character GSTIN"
                  maxLength={15}
                />
              </div>

              {error ? <p className="text-sm text-recoverpe-error">{error}</p> : null}
              {successMessage ? (
                <p className="text-sm text-recoverpe-success">{successMessage}</p>
              ) : null}

              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save business profile"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
