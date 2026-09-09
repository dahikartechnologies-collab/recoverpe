import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import { approvePendingOnboard } from "@/lib/pending-onboards";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { fireKhataReceiptMessage } from "@/lib/whatsapp/khata-receipt";

interface RouteContext {
  params: { id: string };
}

interface ApproveBody {
  amount?: number;
}

export const POST = withWorkspaceMutation<RouteContext>(
  async (request, auth, context) => {
    try {
      const pendingOnboardId = context.params.id?.trim();

      if (!pendingOnboardId) {
        return NextResponse.json(
          { error: "Pending onboard id is required." },
          { status: 400 }
        );
      }

      const body = (await request.json().catch(() => ({}))) as ApproveBody;
      const amount =
        body.amount === undefined ? undefined : Number(body.amount);

      const result = await approvePendingOnboard({
        userId: auth.effectiveUserId,
        pendingOnboardId,
        amount,
      });

      const supabase = createAdminSupabaseClient();
      const { data: business } = await supabase
        .from("businesses")
        .select("business_name")
        .eq("id", result.pending_onboard.business_id)
        .eq("user_id", auth.effectiveUserId)
        .maybeSingle();

      const approvedAmount = result.pending_onboard.amount;

      fireKhataReceiptMessage({
        userId: auth.effectiveUserId,
        contactId: result.contact.id,
        businessId: result.pending_onboard.business_id,
        businessName:
          (business?.business_name as string | undefined) ?? "Your merchant",
        customerName: result.pending_onboard.customer_name,
        phone: result.pending_onboard.customer_phone,
        amount: approvedAmount,
        ledgerId: result.ledger.id,
        resolveUpiLink: true,
      });

      return NextResponse.json({
        pending_onboard: result.pending_onboard,
        ledger_id: result.ledger.id,
        contact_id: result.contact.id,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to approve customer.";

      const status = message.includes("Free plan") ? 402 : 500;

      return NextResponse.json({ error: message }, { status });
    }
  },
  { permission: "manage_team" }
);
