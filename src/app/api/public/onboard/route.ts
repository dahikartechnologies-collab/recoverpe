import { NextResponse } from "next/server";
import {
  fetchPublicKhataBusiness,
  fetchPublicKhataPaymentDetails,
} from "@/lib/khata-qr";
import {
  autoApproveKhataOnboard,
  insertPendingOnboard,
} from "@/lib/pending-onboards";
import { formatIndianPhoneNumber } from "@/lib/invoices";
import { generateKhataUpiIntent } from "@/lib/upi";
import { fireKhataReceiptMessage } from "@/lib/whatsapp/khata-receipt";
import { publicOnboardLimiter, getClientIp } from "@/lib/rate-limit";

interface PublicOnboardBody {
  business_id?: string;
  name?: string;
  phone?: string;
  amount?: number | string;
}

function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10;
}

function parseAmount(value: number | string | undefined): number | null {
  const amount = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export async function POST(request: Request) {
  try {
    if (publicOnboardLimiter) {
      const ip = getClientIp(request);
      const { success, reset } = await publicOnboardLimiter.limit(ip);

      if (!success) {
        return NextResponse.json(
          { error: "Too many requests. Please try again shortly." },
          {
            status: 429,
            headers: {
              "Retry-After": String(
                Math.max(1, Math.ceil(((reset ?? Date.now()) - Date.now()) / 1000))
              ),
            },
          }
        );
      }
    }

    const body = (await request.json()) as PublicOnboardBody;
    const businessId = body.business_id?.trim() ?? "";
    const customerName = body.name?.trim() ?? "";
    const customerPhone = body.phone?.trim() ?? "";
    const amount = parseAmount(body.amount);

    if (!businessId) {
      return NextResponse.json({ error: "business_id is required." }, { status: 400 });
    }

    if (!customerName || customerName.length < 2) {
      return NextResponse.json(
        { error: "Please enter a valid name." },
        { status: 400 }
      );
    }

    if (!isValidPhone(customerPhone)) {
      return NextResponse.json(
        { error: "Please enter a valid 10-digit phone number." },
        { status: 400 }
      );
    }

    if (amount === null) {
      return NextResponse.json(
        { error: "Please enter a valid amount." },
        { status: 400 }
      );
    }

    const business = await fetchPublicKhataBusiness(businessId);

    if (!business) {
      return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    }

    const formattedPhone = formatIndianPhoneNumber(customerPhone);
    const payment = await fetchPublicKhataPaymentDetails(business.id);

    if (business.khata_auto_approve) {
      const result = await autoApproveKhataOnboard({
        businessId: business.id,
        userId: business.user_id,
        customerName,
        customerPhone: formattedPhone,
        amount,
      });

      const upiLink =
        payment?.virtual_upi_id && amount > 0
          ? generateKhataUpiIntent(
              payment.virtual_upi_id,
              payment.payee_name,
              amount
            )
          : null;

      fireKhataReceiptMessage({
        userId: business.user_id,
        contactId: result.contact.id,
        businessId: business.id,
        businessName: business.business_name,
        customerName,
        phone: formattedPhone,
        amount,
        ledgerId: result.ledger.id,
        upiLink,
      });

      return NextResponse.json(
        {
          success: true,
          auto_approved: true,
          amount,
          business_name: business.business_name,
          ledger_id: result.ledger.id,
          contact_id: result.contact.id,
          payment,
        },
        { status: 201 }
      );
    }

    const pendingOnboard = await insertPendingOnboard({
      businessId: business.id,
      customerName,
      customerPhone: formattedPhone,
      amount,
    });

    return NextResponse.json(
      {
        success: true,
        auto_approved: false,
        amount,
        business_name: business.business_name,
        pending_onboard_id: pendingOnboard.id,
        payment,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit onboarding request.";

    const status = message.includes("Free plan") ? 402 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
