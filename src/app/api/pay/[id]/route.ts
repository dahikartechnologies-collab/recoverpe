import { NextResponse } from "next/server";
import { fetchPublicPayLedger } from "@/lib/pay-page";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ledgerId = params.id?.trim();

    if (!ledgerId) {
      return NextResponse.json({ error: "Ledger id is required." }, { status: 400 });
    }

    const payData = await fetchPublicPayLedger(ledgerId);

    if (!payData) {
      return NextResponse.json(
        { error: "Payment link unavailable or invoice already settled." },
        { status: 404 }
      );
    }

    return NextResponse.json({ pay: payData });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load payment page.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
