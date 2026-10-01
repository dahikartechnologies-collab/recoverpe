import { NextResponse } from "next/server";
import { getSafeApiErrorMessage } from "@/lib/api-error-response";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import {
  authorizeSmartStocksBusiness,
  checkVoiceSaleLedgerAllowed,
  createVoiceSaleLedger,
  finalizeVoiceSaleLedger,
  mapSmartStocksRpcError,
  sendVoiceSaleReceipt,
  smartStocksJsonError,
  VoiceSaleLedgerResult,
} from "@/lib/smart-stocks/server";
import {
  isVoiceIntent,
  parseVoiceExecutePayload,
  sumLineTotal,
  VoiceCommandExecuteResponse,
  voiceIntentDirection,
  VoiceReceiptStatus,
} from "@/lib/smart-stocks/shared";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const SCOPE = "voice-execute";

export const POST = withWorkspaceMutation(async (request, auth) => {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return smartStocksJsonError(SCOPE, "Request body must be valid JSON.", 400);
  }

  const parsed = parseVoiceExecutePayload(body);

  if (!parsed.ok) {
    return smartStocksJsonError(SCOPE, parsed.error, 400);
  }

  const payload = parsed.value;
  const supabase = createAdminSupabaseClient();
  const { data: command, error: commandError } = await supabase
    .from("voice_commands")
    .select("id, business_id, intent, status")
    .eq("id", payload.command_id)
    .maybeSingle();

  if (commandError) {
    return smartStocksJsonError(
      SCOPE,
      getSafeApiErrorMessage(commandError, "Failed to load voice command."),
      500
    );
  }

  if (!command) {
    return smartStocksJsonError(SCOPE, "Voice command not found.", 404);
  }

  const access = await authorizeSmartStocksBusiness(
    supabase,
    auth,
    command.business_id,
    SCOPE
  );

  if ("error" in access) {
    return access.error;
  }

  if (command.status !== "pending") {
    return smartStocksJsonError(SCOPE, "This command was already executed.", 409, {
      code: "COMMAND_NOT_PENDING",
    });
  }

  const intent = isVoiceIntent(command.intent) ? command.intent : "sale";
  const direction = voiceIntentDirection(intent);
  const totalAmount = sumLineTotal(payload.items);
  const wantsKhata =
    intent === "sale" && Boolean(payload.customer_name || payload.customer_phone);

  if (wantsKhata && !payload.customer_phone) {
    return smartStocksJsonError(
      SCOPE,
      "Add the customer's mobile number to put this sale on their khata.",
      400
    );
  }

  if (wantsKhata && totalAmount <= 0) {
    return smartStocksJsonError(
      SCOPE,
      "Enter a rate for the items so the khata entry has an amount.",
      400
    );
  }

  let ledger: VoiceSaleLedgerResult | null = null;

  if (wantsKhata && payload.customer_phone) {
    const allowed = await checkVoiceSaleLedgerAllowed(
      supabase,
      auth.workspaceUserId,
      access.business
    );

    if (!allowed.ok) {
      return allowed.response;
    }

    try {
      ledger = await createVoiceSaleLedger(supabase, {
        workspaceUserId: auth.workspaceUserId,
        business: access.business,
        customerName:
          payload.customer_name || `Customer ${payload.customer_phone.slice(-4)}`,
        customerPhone: payload.customer_phone,
        amount: totalAmount,
      });
    } catch (error) {
      console.error(
        `[smart-stocks:${SCOPE}] Khata create failed:`,
        error instanceof Error ? error.message : error
      );
      return smartStocksJsonError(
        SCOPE,
        "Failed to create the khata entry.",
        500
      );
    }
  }

  const { data: result, error: rpcError } = await supabase.rpc(
    "smart_stocks_execute_voice_command",
    {
      p_business_id: access.business.id,
      p_command_id: payload.command_id,
      p_direction: direction,
      p_items: payload.items,
      p_execution: {
        executed_by: auth.actorUserId,
        total_amount: totalAmount,
        ledger_id: ledger?.ledgerId ?? null,
        customer_name: payload.customer_name,
        customer_phone: payload.customer_phone,
      },
    }
  );

  if (rpcError) {
    if (ledger) {
      const { error: rollbackError } = await supabase
        .from("ledgers")
        .delete()
        .eq("id", ledger.ledgerId);

      if (rollbackError) {
        console.error(
          `[smart-stocks:${SCOPE}] Failed to roll back ledger ${ledger.ledgerId}:`,
          rollbackError.message
        );
      }
    }

    const mapped = mapSmartStocksRpcError(rpcError);
    return smartStocksJsonError(SCOPE, mapped.message, mapped.status, {
      code: mapped.code,
    });
  }

  let whatsappStatus: VoiceReceiptStatus = "not_applicable";

  if (ledger) {
    finalizeVoiceSaleLedger(supabase, auth.workspaceUserId, ledger.contactId);
    whatsappStatus = await sendVoiceSaleReceipt(supabase, {
      workspaceUserId: auth.workspaceUserId,
      business: access.business,
      ledger,
      amount: totalAmount,
    });
  }

  const outcome = (result ?? {}) as {
    items?: VoiceCommandExecuteResponse["items"];
  };
  const response: VoiceCommandExecuteResponse = {
    success: true,
    command_id: payload.command_id,
    intent,
    total_amount: totalAmount,
    ledger_id: ledger?.ledgerId ?? null,
    whatsapp_sent: whatsappStatus === "sent",
    whatsapp_status: whatsappStatus,
    items: (outcome.items ?? []).map((item) => ({
      item_id: item.item_id,
      name: item.name,
      qty: Number(item.qty),
      rate: Number(item.rate),
    })),
  };

  return NextResponse.json(response);
}, { permission: "edit_ledgers" });
