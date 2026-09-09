"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { IdentitySupportModal } from "@/components/settings/IdentitySupportModal";
import { ShopQrDownloadButton } from "@/components/dashboard/ShopQrDownloadButton";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  fetchBusinesses,
  updateBusinessSettings,
} from "@/lib/businesses";
import {
  formatAlternatePhoneForInput,
  formatPrimaryPhoneForDisplay,
  requestAccountDeletion,
  updateUserSettings,
} from "@/lib/user-settings";
import { fetchCurrentUser } from "@/lib/users";
import { useWorkspaceStore } from "@/store/workspace-store";
import { Business } from "@/types";

type IdentityField = "Email" | "Primary Phone Number";

interface AlertState {
  message: string;
  variant: "success" | "error";
}

function ReadOnlyField({
  id,
  label,
  value,
  onUpdate,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onUpdate: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-recoverpe-black">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input id={id} value={value} disabled readOnly className="sm:flex-1" />
        <Button
          type="button"
          variant="secondary"
          onClick={onUpdate}
          disabled={disabled}
          className="shrink-0"
        >
          Update
        </Button>
      </div>
    </div>
  );
}

export function SettingsView() {
  const ghostModeUserId = useWorkspaceStore((state) => state.ghostModeUserId);
  const isOwnWorkspaceContext = useWorkspaceStore(
    (state) => state.isOwnWorkspaceContext
  );
  const setBusinesses = useWorkspaceStore((state) => state.setBusinesses);
  const isGhostMode = Boolean(ghostModeUserId);

  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [defaultUpiVpa, setDefaultUpiVpa] = useState("");
  const [accountStatus, setAccountStatus] = useState<string>("active");
  const [businessProfiles, setBusinessProfiles] = useState<Business[]>([]);
  const [msmeRegByBusinessId, setMsmeRegByBusinessId] = useState<
    Record<string, string>
  >({});

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isSavingCompliance, setIsSavingCompliance] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [alert, setAlert] = useState<AlertState | null>(null);
  const [identityModalField, setIdentityModalField] = useState<IdentityField | null>(
    null
  );

  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);
      setAlert(null);

      try {
        const [user, businesses] = await Promise.all([
          fetchCurrentUser(),
          fetchBusinesses(),
        ]);
        setEmail(user.email);
        setPhoneNumber(formatPrimaryPhoneForDisplay(user.phone_number));
        setFullName(user.full_name ?? "");
        setAlternatePhone(formatAlternatePhoneForInput(user.alternate_phone));
        setBillingAddress(user.billing_address ?? "");
        setDefaultUpiVpa(user.default_upi_vpa ?? "");
        setAccountStatus(user.account_status);
        setBusinessProfiles(businesses);
        setMsmeRegByBusinessId(
          Object.fromEntries(
            businesses.map((business) => [business.id, business.msme_reg_no ?? ""])
          )
        );
        setBusinesses(businesses);
      } catch (loadError) {
        setAlert({
          message:
            loadError instanceof Error
              ? loadError.message
              : "Failed to load profile.",
          variant: "error",
        });
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, [setBusinesses]);

  function handleMsmeRegChange(businessId: string, value: string) {
    setMsmeRegByBusinessId((current) => ({
      ...current,
      [businessId]: value.toUpperCase(),
    }));
  }

  async function handleSaveBusinessCompliance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    setIsSavingCompliance(true);

    try {
      const updatedBusinesses = await Promise.all(
        businessProfiles.map((business) =>
          updateBusinessSettings(business.id, {
            msme_reg_no: msmeRegByBusinessId[business.id]?.trim() || null,
          })
        )
      );

      setBusinessProfiles(updatedBusinesses);
      setMsmeRegByBusinessId(
        Object.fromEntries(
          updatedBusinesses.map((business) => [
            business.id,
            business.msme_reg_no ?? "",
          ])
        )
      );
      setBusinesses(updatedBusinesses);
      setAlert({
        message: "Business compliance settings saved successfully.",
        variant: "success",
      });
    } catch (saveError) {
      setAlert({
        message:
          saveError instanceof Error
            ? saveError.message
            : "Failed to save business compliance settings.",
        variant: "error",
      });
    } finally {
      setIsSavingCompliance(false);
    }
  }

  async function handleSavePersonalDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    setIsSavingPersonal(true);

    try {
      const result = await updateUserSettings({
        full_name: fullName.trim() || null,
        alternate_phone: alternatePhone.trim() || null,
        billing_address: billingAddress.trim() || null,
      });

      setFullName(result.full_name ?? "");
      setAlternatePhone(formatAlternatePhoneForInput(result.alternate_phone));
      setBillingAddress(result.billing_address ?? "");
      setAlert({
        message: "Personal details saved successfully.",
        variant: "success",
      });
    } catch (saveError) {
      setAlert({
        message:
          saveError instanceof Error
            ? saveError.message
            : "Failed to save personal details.",
        variant: "error",
      });
    } finally {
      setIsSavingPersonal(false);
    }
  }

  async function handleSavePaymentSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    setIsSavingPayment(true);

    try {
      const result = await updateUserSettings({
        default_upi_vpa: defaultUpiVpa.trim() || null,
      });

      setDefaultUpiVpa(result.default_upi_vpa ?? "");
      setAlert({
        message: "Payment settings saved successfully.",
        variant: "success",
      });
    } catch (saveError) {
      setAlert({
        message:
          saveError instanceof Error
            ? saveError.message
            : "Failed to save payment settings.",
        variant: "error",
      });
    } finally {
      setIsSavingPayment(false);
    }
  }

  async function handleDeleteAccount() {
    const confirmed = window.confirm(
      "This will schedule permanent deletion of your account and all associated data per DPDP compliance. Continue?"
    );

    if (!confirmed) {
      return;
    }

    setAlert(null);
    setIsDeleting(true);

    try {
      const message = await requestAccountDeletion();
      setAccountStatus("pending_purge");
      setAlert({ message, variant: "success" });
    } catch (deleteError) {
      setAlert({
        message:
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to schedule account deletion.",
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-recoverpe-grey-medium">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-recoverpe-grey-medium">
          Account
        </p>
        <h1 className="text-2xl font-semibold text-recoverpe-black">
          Profile & Settings
        </h1>
        <p className="max-w-2xl text-sm text-recoverpe-grey-medium">
          Manage your identity, payment defaults, and compliance preferences in one
          place.
        </p>
      </div>

      {alert ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            alert.variant === "success"
              ? "border-recoverpe-grey-light text-recoverpe-black"
              : "border-recoverpe-error text-recoverpe-error"
          }`}
        >
          {alert.message}
        </div>
      ) : null}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-recoverpe-black">
              Personal Details
            </h2>
            <p className="mt-1 text-sm text-recoverpe-grey-medium">
              Used on invoices, receipts, and account correspondence.
            </p>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => void handleSavePersonalDetails(event)}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label
                    htmlFor="fullName"
                    className="text-sm font-medium text-recoverpe-black"
                  >
                    Full Name
                  </label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Suraj Dahikar"
                    disabled={isGhostMode || isSavingPersonal}
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="alternatePhone"
                    className="text-sm font-medium text-recoverpe-black"
                  >
                    Alternate Mobile
                  </label>
                  <Input
                    id="alternatePhone"
                    value={alternatePhone}
                    onChange={(event) =>
                      setAlternatePhone(event.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    placeholder="9876543210"
                    inputMode="numeric"
                    disabled={isGhostMode || isSavingPersonal}
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="billingAddress"
                  className="text-sm font-medium text-recoverpe-black"
                >
                  Billing Address
                </label>
                <textarea
                  id="billingAddress"
                  value={billingAddress}
                  onChange={(event) => setBillingAddress(event.target.value)}
                  placeholder="Street, city, state, PIN"
                  rows={4}
                  maxLength={500}
                  disabled={isGhostMode || isSavingPersonal}
                  className="w-full rounded-md border border-recoverpe-grey-light bg-recoverpe-white px-3 py-2.5 text-sm text-recoverpe-black outline-none transition-colors placeholder:text-recoverpe-grey-medium focus:border-recoverpe-black disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="flex justify-end border-t border-recoverpe-grey-light pt-4">
                <Button type="submit" disabled={isGhostMode || isSavingPersonal}>
                  {isSavingPersonal ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-recoverpe-black">
              Security & Login
            </h2>
            <p className="mt-1 text-sm text-recoverpe-grey-medium">
              Your verified identity credentials are locked for security.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReadOnlyField
              id="verifiedEmail"
              label="Verified Email"
              value={email}
              onUpdate={() => setIdentityModalField("Email")}
              disabled={isGhostMode}
            />
            <ReadOnlyField
              id="verifiedPhone"
              label="Primary Phone Number"
              value={phoneNumber}
              onUpdate={() => setIdentityModalField("Primary Phone Number")}
              disabled={isGhostMode}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-recoverpe-black">
              Payment Configuration
            </h2>
            <p className="mt-1 text-sm text-recoverpe-grey-medium">
              Default merchant UPI ID for pay links and invoice QR codes.
            </p>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => void handleSavePaymentSettings(event)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label
                  htmlFor="defaultUpiVpa"
                  className="text-sm font-medium text-recoverpe-black"
                >
                  Default UPI VPA
                </label>
                <Input
                  id="defaultUpiVpa"
                  value={defaultUpiVpa}
                  onChange={(event) => setDefaultUpiVpa(event.target.value)}
                  placeholder="merchant@upi"
                  disabled={isGhostMode || isSavingPayment}
                />
                <p className="text-xs text-recoverpe-grey-medium">
                  Overrides the platform fallback on `/pay` pages when set.
                </p>
              </div>
              <div className="flex justify-end border-t border-recoverpe-grey-light pt-4">
                <Button type="submit" disabled={isGhostMode || isSavingPayment}>
                  {isSavingPayment ? "Saving..." : "Save Payment Settings"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-recoverpe-black">
              Business Compliance
            </h2>
            <p className="mt-1 text-sm text-recoverpe-grey-medium">
              MSME registration numbers appear on generated tax invoices.
            </p>
          </CardHeader>
          <CardContent>
            {businessProfiles.length === 0 ? (
              <p className="text-sm text-recoverpe-grey-medium">
                Add a business profile from the dashboard to configure your MSME
                registration number.
              </p>
            ) : (
              <form
                onSubmit={(event) => void handleSaveBusinessCompliance(event)}
                className="space-y-4"
              >
                {businessProfiles.map((business) => (
                  <div
                    key={business.id}
                    className="space-y-2 rounded-md border border-recoverpe-grey-light p-4"
                  >
                    <p className="text-sm font-medium text-recoverpe-black">
                      {business.business_name}
                    </p>
                    <div className="space-y-2">
                      <label
                        htmlFor={`msme-${business.id}`}
                        className="text-sm font-medium text-recoverpe-black"
                      >
                        MSME / Udyam Registration No.
                      </label>
                      <Input
                        id={`msme-${business.id}`}
                        value={msmeRegByBusinessId[business.id] ?? ""}
                        onChange={(event) =>
                          handleMsmeRegChange(business.id, event.target.value)
                        }
                        placeholder="UDYAM-MH-00-0000000"
                        disabled={isGhostMode || isSavingCompliance}
                        maxLength={32}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex justify-end border-t border-recoverpe-grey-light pt-4">
                  <Button type="submit" disabled={isGhostMode || isSavingCompliance}>
                    {isSavingCompliance ? "Saving..." : "Save Compliance Settings"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-recoverpe-black">
              Khata QR
            </h2>
            <p className="mt-1 text-sm text-recoverpe-grey-medium">
              Print your shop QR so retail customers can self-onboard without
              manual entry.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {businessProfiles.length === 0 ? (
              <p className="text-sm text-recoverpe-grey-medium">
                Add a business profile to generate your Khata QR code.
              </p>
            ) : (
              businessProfiles.map((business) => (
                <div
                  key={business.id}
                  className="flex flex-col gap-3 rounded-md border border-recoverpe-grey-light p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-recoverpe-black">
                      {business.business_name}
                    </p>
                    <p className="mt-1 text-xs text-recoverpe-grey-medium">
                      Customers scan to join your onboarding queue.
                    </p>
                  </div>
                  <ShopQrDownloadButton
                    businessId={business.id}
                    businessName={business.business_name}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {isOwnWorkspaceContext ? (
          <Card className="border-recoverpe-error">
            <CardHeader className="border-recoverpe-error/30">
              <h2 className="text-base font-semibold text-recoverpe-error">
                Danger Zone
              </h2>
              <p className="mt-1 text-sm text-recoverpe-grey-medium">
                Irreversible account actions under DPDP compliance.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-recoverpe-grey-medium">
                Request permanent deletion of your Recoverpe account and all associated
                personal data. This action schedules a purge and cannot be undone from
                the dashboard.
              </p>

              {accountStatus === "pending_purge" ? (
                <p className="rounded-md border border-recoverpe-grey-light px-4 py-3 text-sm text-recoverpe-grey-medium">
                  Your account is scheduled for deletion. Contact{" "}
                  <a
                    href="mailto:admin@recoverpe.com"
                    className="font-medium text-recoverpe-black underline underline-offset-2"
                  >
                    admin@recoverpe.com
                  </a>{" "}
                  if you need to cancel this request.
                </p>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleDeleteAccount()}
                  disabled={isDeleting || isGhostMode}
                  className="border-recoverpe-error text-recoverpe-error hover:bg-recoverpe-error/5"
                >
                  {isDeleting ? "Processing..." : "Delete My Account & Data"}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Link
        href="/dashboard"
        className="inline-block text-sm font-medium text-recoverpe-black underline underline-offset-2"
      >
        Back to dashboard
      </Link>

      <IdentitySupportModal
        isOpen={identityModalField !== null}
        onClose={() => setIdentityModalField(null)}
        fieldLabel={identityModalField ?? "Email"}
      />
    </div>
  );
}
