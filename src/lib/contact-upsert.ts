import { formatIndianPhoneNumber } from "@/lib/invoices";
import { isValidContactEmail } from "@/lib/notification-settings";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { Contact } from "@/types";

const CONTACT_SELECT =
  "id, user_id, name, phone_number, email, client_gstin, billing_address, wallet_balance, created_at";

export interface UpsertContactInput {
  contactName: string;
  phoneNumber: string;
  clientGstin?: string | null;
  contactEmail?: string | null;
}

export interface UpsertContactResult {
  contact: Contact;
  isNew: boolean;
}

export async function upsertContactForUser(
  userId: string,
  input: UpsertContactInput
): Promise<UpsertContactResult> {
  const supabase = createAdminSupabaseClient();
  const formattedPhone = formatIndianPhoneNumber(input.phoneNumber);
  const normalizedEmail =
    input.contactEmail && isValidContactEmail(input.contactEmail)
      ? input.contactEmail.trim()
      : null;

  const { data: existingContact, error: lookupError } = await supabase
    .from("contacts")
    .select(CONTACT_SELECT)
    .eq("user_id", userId)
    .eq("phone_number", formattedPhone)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message || "Failed to lookup contact.");
  }

  if (existingContact) {
    const { data: updatedContact, error: updateError } = await supabase
      .from("contacts")
      .update({
        name: input.contactName.trim(),
        client_gstin:
          input.clientGstin?.trim() || existingContact.client_gstin,
        email: normalizedEmail ?? existingContact.email,
      })
      .eq("id", existingContact.id)
      .select(CONTACT_SELECT)
      .single();

    if (updateError || !updatedContact) {
      throw new Error(updateError?.message || "Failed to update contact.");
    }

    return { contact: updatedContact as Contact, isNew: false };
  }

  const { data: createdContact, error: createError } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      name: input.contactName.trim(),
      phone_number: formattedPhone,
      email: normalizedEmail,
      client_gstin: input.clientGstin?.trim() || null,
    })
    .select(CONTACT_SELECT)
    .single();

  if (createError || !createdContact) {
    throw new Error(createError?.message || "Failed to create contact.");
  }

  return { contact: createdContact as Contact, isNew: true };
}
