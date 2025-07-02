import { Client } from "postmark";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

const POSTMARK_API_TOKEN = config.email.postmarkApiToken;
const FROM_EMAIL: string = config.email.from;

let postmarkClient: Client | null = null;
if (POSTMARK_API_TOKEN && FROM_EMAIL) {
  postmarkClient = new Client(POSTMARK_API_TOKEN);
} else {
  logger.error(
    "EmailService: POSTMARK_API_TOKEN or SMTP_FROM is not set. Emails will not be sent.",
  );
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!postmarkClient || !FROM_EMAIL) {
    logger.error(
      `EmailService: Cannot send email to ${to} because email service is not configured. Subject: ${subject}`,
    );
    return {
      message: `Email service not configured. Email to ${to} not sent.`,
    };
  }
  const result = await postmarkClient.sendEmail({
    To: to,
    From: FROM_EMAIL,
    Subject: subject,
    HtmlBody: html,
  });
  if (result.ErrorCode) {
    logger.error(
      `EmailService: Failed to send email to ${to}:`,
      result.Message,
    );
  } else {
    logger.info(`Email sent successfully to ${to} with subject: ${subject}`);
  }
  return {
    ...result,
    message: `An email to ${to} was sent successfully`,
  };
}

export async function sendBulkEmail({
  toList,
  subject,
  html,
}: {
  toList: string[];
  subject: string;
  html: string;
}) {
  if (!postmarkClient || !FROM_EMAIL) {
    logger.error(
      `EmailService: Cannot send bulk email to ${toList.join(
        ",",
      )} because email service is not configured. Subject: ${subject}`,
    );
    return {
      message: `Email service not configured. Bulk email not sent.`,
    };
  }
  const result = await postmarkClient.sendEmail({
    To: FROM_EMAIL, // send a copy to sender
    From: FROM_EMAIL,
    Bcc: toList.join(","),
    Subject: subject,
    HtmlBody: html,
  });
  if (result.ErrorCode) {
    logger.error(`EmailService: Failed to send bulk email:`, result.Message);
  } else {
    logger.info(
      `Bulk email sent successfully to ${toList.length} recipients with subject: ${subject}`,
    );
  }
  return {
    ...result,
    message: `An email was sent successfully to ${toList.length} recipients. A copy was also sent to the sender.`,
  };
}
