import { NextResponse } from "next/server";
import { withWorkspaceMutation } from "@/lib/auth-gateway";
import {
  authorizeSmartStocksBusiness,
  smartStocksJsonError,
} from "@/lib/smart-stocks/server";
import {
  matchStockItemName,
  MAX_TRANSCRIPT_LENGTH,
  VoiceCommandDraft,
  VoiceCommandParseResponse,
  VoiceDraftItem,
} from "@/lib/smart-stocks/shared";
import { parseVoiceCommandWithGemini } from "@/lib/smart-stocks/voice-command";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { StockItemRow } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SCOPE = "voice-command";
const MAX_STOCK_ITEMS_FOR_MATCHING = 2000;

export const POST = withWorkspaceMutation(async (request, auth) => {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return smartStocksJsonError(SCOPE, "Request body must be valid JSON.", 400);
  }

  const transcript =
    typeof body.transcript === "string" ? body.transcript.trim() : "";

  if (!transcript) {
    return smartStocksJsonError(SCOPE, "Say or type what was sold.", 400);
  }

  if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return smartStocksJsonError(
      SCOPE,
      `Keep the command under ${MAX_TRANSCRIPT_LENGTH} characters.`,
      400
    );
  }

  const supabase = createAdminSupabaseClient();
  const access = await authorizeSmartStocksBusiness(
    supabase,
    auth,
    body.business_id,
    SCOPE
  );

  if ("error" in access) {
    return access.error;
  }

  const businessId = access.business.id;
  const { data: stockRows, error: stockError } = await supabase
    .from("stock_items")
    .select("id, name, unit, qty_on_hand, selling_price, last_cost")
    .eq("business_id", businessId)
    .order("name", { ascending: true })
    .limit(MAX_STOCK_ITEMS_FOR_MATCHING);

  if (stockError) {
    return smartStocksJsonError(SCOPE, stockError.message, 500);
  }

  const stockItems = (stockRows ?? []) as Pick<
    StockItemRow,
    "id" | "name" | "unit" | "qty_on_hand" | "selling_price" | "last_cost"
  >[];

  let parsed;

  try {
    parsed = await parseVoiceCommandWithGemini(
      transcript,
      stockItems.map((item) => item.name)
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to understand the command.";

    await supabase.from("voice_commands").insert({
      business_id: businessId,
      transcript,
      intent: "unknown",
      parsed_payload: { error: message },
      status: "failed",
    });

    return smartStocksJsonError(SCOPE, message, 502);
  }

  const itemsById = new Map(stockItems.map((item) => [item.id, item]));
  const draftItems: VoiceDraftItem[] = parsed.items.map((item) => {
    const match = matchStockItemName(item.name, stockItems);
    const stock = match ? itemsById.get(match.item_id) : undefined;
    const fallbackRate =
      parsed.intent === "purchase"
        ? Number(stock?.last_cost ?? 0)
        : Number(stock?.selling_price ?? 0);

    return {
      ...item,
      match,
      suggested_rate: item.unit_price ?? fallbackRate,
      qty_on_hand: stock ? Number(stock.qty_on_hand) : null,
      unit: stock?.unit ?? null,
    };
  });

  const { data: command, error: insertError } = await supabase
    .from("voice_commands")
    .insert({
      business_id: businessId,
      transcript,
      intent: parsed.intent,
      parsed_payload: { parsed, items: draftItems },
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !command) {
    return smartStocksJsonError(
      SCOPE,
      insertError?.message || "Failed to save the voice command.",
      500
    );
  }

  const draft: VoiceCommandDraft = {
    command_id: command.id as string,
    transcript,
    parsed,
    items: draftItems,
  };
  const response: VoiceCommandParseResponse = { draft };

  return NextResponse.json(response, { status: 201 });
}, { permission: "edit_ledgers" });
