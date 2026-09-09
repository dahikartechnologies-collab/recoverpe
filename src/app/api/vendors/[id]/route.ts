import { NextResponse } from "next/server";
import { resolveEffectiveUserContext } from "@/lib/api-auth";
import {
  fetchContactDirectory,
  fetchLedgersForContact,
  fetchWalletTransactionsForContact,
} from "@/lib/vendor-queries";
import {
  fetchVirtualAccountForContact,
  resolveBusinessIdForContact,
} from "@/lib/virtual-account-queries";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

interface RouteContext {
  params: { id: string };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const contextResult = await resolveEffectiveUserContext(request);

    if ("error" in contextResult) {
      return contextResult.error;
    }

    const contactId = context.params.id?.trim();

    if (!contactId) {
      return NextResponse.json({ error: "Vendor id is required." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const limitParam = Number.parseInt(searchParams.get("limit") ?? "50", 10);
    const workspaceMode = searchParams.get("workspace_mode")?.trim() ?? "business";
    const businessIdParam = searchParams.get("business_id")?.trim() ?? "";
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isFinite(limitParam) ? limitParam : 50;
    const offset = (page - 1) * limit;

    const supabase = createAdminSupabaseClient();

    let businessId: string | null = null;

    if (workspaceMode === "personal") {
      businessId = null;
    } else if (businessIdParam) {
      businessId = businessIdParam;
    } else {
      businessId = await resolveBusinessIdForContact(
        supabase,
        contextResult.effectiveUserId,
        contactId,
        null
      );
    }

    const directory = await fetchContactDirectory(
      supabase,
      contextResult.effectiveUserId,
      { limit: 1, offset: 0, contactId, businessId }
    );

    const contact = directory.contacts[0];

    if (!contact) {
      return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    }

    const resolvedBusinessIdPromise =
      businessId !== null
        ? Promise.resolve(businessId)
        : resolveBusinessIdForContact(
            supabase,
            contextResult.effectiveUserId,
            contactId,
            businessIdParam || null
          );

    const [ledgerPage, contactWalletResult, resolvedBusinessId, walletTransactions] =
      await Promise.all([
      fetchLedgersForContact(
        supabase,
        contextResult.effectiveUserId,
        contactId,
        { limit, offset, businessId }
      ),
      supabase
        .from("contacts")
        .select(
          "wallet_balance, virtual_account_id, virtual_upi_id, virtual_bank_account_number, virtual_ifsc_code"
        )
        .eq("id", contactId)
        .eq("user_id", contextResult.effectiveUserId)
        .maybeSingle(),
      resolvedBusinessIdPromise,
      fetchWalletTransactionsForContact(
        supabase,
        contextResult.effectiveUserId,
        contactId
      ),
    ]);

    if (contactWalletResult.error) {
      return NextResponse.json(
        {
          error:
            contactWalletResult.error.message || "Failed to load wallet balance.",
        },
        { status: 500 }
      );
    }

    const contactWallet = contactWalletResult.data;

    const [virtualAccount, businessResult] = await Promise.all([
      resolvedBusinessId
        ? fetchVirtualAccountForContact(
            supabase,
            contextResult.effectiveUserId,
            contactId,
            resolvedBusinessId
          )
        : Promise.resolve(null),
      resolvedBusinessId
        ? supabase
            .from("businesses")
            .select("business_name")
            .eq("id", resolvedBusinessId)
            .eq("user_id", contextResult.effectiveUserId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const businessName = (businessResult.data?.business_name as string | undefined) ?? null;

    const contactVirtualAccount =
      contactWallet?.virtual_account_id ||
      contactWallet?.virtual_upi_id ||
      contactWallet?.virtual_bank_account_number
        ? {
            virtual_account_id:
              (contactWallet.virtual_account_id as string | null) ?? null,
            virtual_upi_id: (contactWallet.virtual_upi_id as string | null) ?? null,
            virtual_bank_account_number:
              (contactWallet.virtual_bank_account_number as string | null) ?? null,
            virtual_ifsc_code:
              (contactWallet.virtual_ifsc_code as string | null) ?? null,
          }
        : null;

    return NextResponse.json({
      contact,
      ledgers: ledgerPage.ledgers,
      wallet_transactions: walletTransactions,
      pagination: {
        total: ledgerPage.total,
        limit,
        offset,
        page,
        hasMore: offset + ledgerPage.ledgers.length < ledgerPage.total,
      },
      virtual_account: virtualAccount,
      contact_virtual_account: contactVirtualAccount,
      business_id: resolvedBusinessId,
      business_name: businessName,
      wallet_balance: Number(contactWallet?.wallet_balance ?? 0),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load vendor statement.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
