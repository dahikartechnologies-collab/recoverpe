import nodemailer from "nodemailer";
import { isDevelopmentAppEnv } from "@/lib/app-env";
import { BusinessSmtpSettings } from "@/types";

export interface SendBusinessEmailInput {
  smtpSettings: BusinessSmtpSettings;
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    href?: string;
  }>;
}

export interface SendBusinessEmailResult {
  success: boolean;
  simulated: boolean;
  message: string;
  messageId?: string;
}

export async function sendBusinessEmail(
  input: SendBusinessEmailInput
): Promise<SendBusinessEmailResult> {
  const { smtpSettings, to, subject, html, attachments } = input;
  const fromName = smtpSettings.from_name || smtpSettings.from_email;
  const fromAddress = `"${fromName}" <${smtpSettings.from_email}>`;

  if (isDevelopmentAppEnv()) {
    console.log("[Recoverpe Email Dev Bypass]", {
      environment: process.env.APP_ENV,
      to,
      from: fromAddress,
      subject,
      htmlPreview: html.slice(0, 280),
      attachmentCount: attachments?.length ?? 0,
    });

    return {
      success: true,
      simulated: true,
      message: "Email simulated in development mode.",
    };
  }

  if (
    !smtpSettings.host ||
    !smtpSettings.user ||
    !smtpSettings.pass ||
    !smtpSettings.from_email
  ) {
    throw new Error("SMTP credentials are incomplete.");
  }

  const transport = nodemailer.createTransport({
    host: smtpSettings.host,
    port: smtpSettings.port,
    secure: smtpSettings.secure,
    auth: {
      user: smtpSettings.user,
      pass: smtpSettings.pass,
    },
  });

  const info = await transport.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
    attachments,
  });

  return {
    success: true,
    simulated: false,
    message: "Email sent successfully.",
    messageId: info.messageId,
  };
}
