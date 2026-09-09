import { createVirtualAccount } from "@/lib/payments/razorpay-client";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export async function provisionContactVirtualAccount(input: {
  userId: string;
  contactId: string;
  contactName: string;
}): Promise<void> {
  const supabase = createAdminSupabaseClient();

  const { data: existingContact, error: lookupError } = await supabase
    .from("contacts")
    .select("id, virtual_account_id")
    .eq("id", input.contactId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message || "Failed to load contact for VA provisioning.");
  }

  if (!existingContact) {
    throw new Error("Contact not found for virtual account provisioning.");
  }

  if (existingContact.virtual_account_id) {
    return;
  }

  const virtualAccount = await createVirtualAccount(input.contactName);

  const { error: updateError } = await supabase
    .from("contacts")
    .update({
      virtual_account_id: virtualAccount.id,
      virtual_upi_id: virtualAccount.virtualUpiId,
      virtual_bank_account_number: virtualAccount.virtualAccountNumber,
      virtual_ifsc_code: virtualAccount.ifscCode,
    })
    .eq("id", input.contactId)
    .eq("user_id", input.userId)
    .is("virtual_account_id", null);

  if (updateError) {
    throw new Error(
      updateError.message || "Failed to persist contact virtual account details."
    );
  }
}

export function scheduleContactVirtualAccountProvisioning(input: {
  userId: string;
  contactId: string;
  contactName: string;
}): void {
  void provisionContactVirtualAccount(input).catch((error) => {
    console.error(
      "[smart-collect] Failed to provision contact virtual account:",
      error instanceof Error ? error.message : error
    );
  });
}
