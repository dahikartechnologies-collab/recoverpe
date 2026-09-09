import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Single read path for "which contact owns this Razorpay virtual account?".
 *
 * contacts.virtual_account_id is canonical (Sprint 52). virtual_accounts is the
 * legacy business-scoped table, still written by the vendor VA endpoint and
 * still holding rows that migration 036 could not fold in (contacts with more
 * than one business-scoped VA). It is consulted read-only, second.
 */

export type VirtualAccountSource = "contact" | "legacy_virtual_account";

export interface ResolvedVirtualAccountOwner {
  contactId: string;
  userId: string;
  contactName: string;
  phoneNumber: string;
  source: VirtualAccountSource;
  /** virtual_accounts.id, when the match came from the legacy table. */
  legacyVirtualAccountId: string | null;
  /** virtual_accounts.business_id, when the match came from the legacy table. */
  legacyBusinessId: string | null;
}

interface ContactRow {
  id: string;
  user_id: string;
  name: string;
  phone_number: string;
}

async function loadContact(
  supabase: SupabaseClient,
  contactId: string
): Promise<ContactRow | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select("id, user_id, name, phone_number")
    .eq("id", contactId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load contact.");
  }

  return (data as ContactRow | null) ?? null;
}

export async function resolveVirtualAccountOwner(
  supabase: SupabaseClient,
  providerReferenceId: string
): Promise<ResolvedVirtualAccountOwner | null> {
  const { data: canonical, error: canonicalError } = await supabase
    .from("contacts")
    .select("id, user_id, name, phone_number")
    .eq("virtual_account_id", providerReferenceId)
    .maybeSingle();

  if (canonicalError) {
    throw new Error(
      canonicalError.message || "Failed to resolve contact from virtual account."
    );
  }

  if (canonical) {
    const contact = canonical as ContactRow;

    return {
      contactId: contact.id,
      userId: contact.user_id,
      contactName: contact.name,
      phoneNumber: contact.phone_number,
      source: "contact",
      legacyVirtualAccountId: null,
      legacyBusinessId: null,
    };
  }

  const { data: legacy, error: legacyError } = await supabase
    .from("virtual_accounts")
    .select("id, user_id, business_id, contact_id, status")
    .eq("provider", "razorpay")
    .eq("provider_reference_id", providerReferenceId)
    .maybeSingle();

  if (legacyError) {
    throw new Error(
      legacyError.message || "Failed to resolve legacy virtual account."
    );
  }

  if (!legacy || legacy.status !== "active") {
    return null;
  }

  const contact = await loadContact(supabase, legacy.contact_id as string);

  if (!contact) {
    return null;
  }

  return {
    contactId: contact.id,
    userId: contact.user_id,
    contactName: contact.name,
    phoneNumber: contact.phone_number,
    source: "legacy_virtual_account",
    legacyVirtualAccountId: legacy.id as string,
    legacyBusinessId: (legacy.business_id as string | null) ?? null,
  };
}
