import { NextResponse } from "next/server";
import { withWorkspaceAuth } from "@/lib/auth-gateway";
import { sendBusinessEmail } from "@/lib/email/nodemailer";
import { buildSmtpTestEmail } from "@/lib/email/templates";
import {
  isSmtpConfigured,
  isValidContactEmail,
  parseSmtpSettings,
} from "@/lib/notification-settings";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { BusinessSmtpSettings } from "@/types";

export const POST = withWorkspaceAuth(async (request, auth) => {
  const body = (await request.json()) as {
    business_id?: string;
    recipient_email?: string;
    smtp_settings?: BusinessSmtpSettings;
  };

  const businessId = body.business_id?.trim();
  const recipientEmail = body.recipient_email?.trim();

  if (!businessId) {
    return NextResponse.json({ error: "business_id is required." }, { status: 400 });
  }

  if (!recipientEmail || !isValidContactEmail(recipientEmail)) {
    return NextResponse.json(
      { error: "A valid recipient_email is required." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabaseClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("business_name, smtp_settings")
    .eq("id", businessId)
    .eq("user_id", auth.workspaceUserId)
    .maybeSingle();

  if (error || !business) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  const submittedSmtp = body.smtp_settings
    ? parseSmtpSettings(body.smtp_settings)
    : null;
  const storedSmtp = parseSmtpSettings(business.smtp_settings);
  const smtpSettings = submittedSmtp ?? storedSmtp;

  if (submittedSmtp && !submittedSmtp.pass && storedSmtp.pass) {
    smtpSettings.pass = storedSmtp.pass;
  }

  if (!isSmtpConfigured(smtpSettings)) {
    return NextResponse.json(
      { error: "Complete SMTP settings before sending a test email." },
      { status: 400 }
    );
  }

  const email = buildSmtpTestEmail({
    businessName: business.business_name as string,
    recipientEmail,
  });

  try {
    const result = await sendBusinessEmail({
      smtpSettings,
      to: recipientEmail,
      subject: email.subject,
      html: email.html,
    });

    return NextResponse.json({
      success: true,
      simulated: result.simulated,
      message: result.message,
    });
  } catch (sendError) {
    const message =
      sendError instanceof Error ? sendError.message : "SMTP test failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}, { requiredPermission: "edit_settings" });
