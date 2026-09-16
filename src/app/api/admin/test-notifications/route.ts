import { NextResponse } from "next/server";
import { requireSuperAdminUser } from "@/lib/api-auth";
import { getPayPageUrl } from "@/lib/app-url";
import { sendDebtReminderEmail } from "@/lib/notifications/email";
import {
  buildDebtReminderSmsMessage,
  sendTransactionalSms,
} from "@/lib/notifications/sms";

export const dynamic = "force-dynamic";

interface TestNotificationsPayload {
  email?: string;
  phone?: string;
}

export async function POST(request: Request) {
  try {
    const authResult = await requireSuperAdminUser(request);

    if ("error" in authResult) {
      return authResult.error;
    }

    const body = (await request.json()) as TestNotificationsPayload;
    const email = body.email?.trim();
    const phone = body.phone?.trim();

    if (!email && !phone) {
      return NextResponse.json(
        { error: "Provide at least one of email or phone." },
        { status: 400 }
      );
    }

    const sampleLedgerId = "00000000-0000-4000-8000-000000000001";
    const samplePayUrl = getPayPageUrl(sampleLedgerId);

    let emailSuccess = false;
    let emailResponse: unknown;

    if (email) {
      emailResponse = await sendDebtReminderEmail({
        to: email,
        businessName: "RecoverPe Diagnostics",
        contactName: "Test Recipient",
        invoiceNumber: "INV-DIAG-001",
        amountDue: 12500,
        dueDate: new Date().toISOString().slice(0, 10),
        ledgerId: sampleLedgerId,
      });
      emailSuccess =
        typeof emailResponse === "object" &&
        emailResponse !== null &&
        "success" in emailResponse
          ? Boolean((emailResponse as { success?: boolean }).success)
          : false;
    }

    let smsSuccess = false;
    let smsResponse: unknown;

    if (phone) {
      smsResponse = await sendTransactionalSms({
        phoneNumber: phone,
        message: buildDebtReminderSmsMessage({
          amount: 12500,
          businessName: "RecoverPe Diagnostics",
          payUrl: samplePayUrl,
        }),
      });
      smsSuccess =
        typeof smsResponse === "object" &&
        smsResponse !== null &&
        "success" in smsResponse
          ? Boolean((smsResponse as { success?: boolean }).success)
          : false;
    }

    return NextResponse.json({
      emailSuccess,
      ...(emailResponse !== undefined ? { emailResponse } : {}),
      smsSuccess,
      ...(smsResponse !== undefined ? { smsResponse } : {}),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Notification diagnostics failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
