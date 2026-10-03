import { describe, expect, it } from "vitest";
import { isGstRegistrationDeclared } from "@/lib/business-profile";
import { validateBusinessSettingsUpdate } from "@/lib/business-settings-validation";

describe("GST registration status", () => {
  it("treats a GSTIN as declared", () => {
    expect(
      isGstRegistrationDeclared({
        gstin: "27AAPFU0939F1ZV",
        gst_not_required: false,
      })
    ).toBe(true);
  });

  it("treats an unregistered checkbox as declared", () => {
    expect(
      isGstRegistrationDeclared({
        gstin: null,
        gst_not_required: true,
      })
    ).toBe(true);
  });

  it("blocks legal docs when GST status is unknown", () => {
    expect(
      isGstRegistrationDeclared({
        gstin: null,
        gst_not_required: false,
      })
    ).toBe(false);
  });

  it("clears GSTIN when the merchant marks GST as not required", () => {
    const result = validateBusinessSettingsUpdate({
      gstin: "27AAPFU0939F1ZV",
      gst_not_required: true,
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.gstin).toBeNull();
    expect(result.data?.gst_not_required).toBe(true);
  });
});
