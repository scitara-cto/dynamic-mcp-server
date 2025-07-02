import { Client } from "postmark";
import { config } from "../config/index.js";
import logger from "../utils/logger.js";

function getPostmarkClient(): Client | null {
  const token = config.email.postmarkApiToken;
  const from = config.email.from;

  logger.debug(`EmailService: Initializing Postmark client. Token: '${token}', From: '${from}'`);

  if (token && from) {
    return new Client(token);
  }
  logger.error(
    "EmailService: POSTMARK_API_TOKEN or SMTP_FROM is not set in config. Emails will not be sent.",
  );
  return null;
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
  const postmarkClient = getPostmarkClient();
  const fromEmail = config.email.from;

  if (!postmarkClient || !fromEmail) {
    logger.error(
      `EmailService: Cannot send email to ${to} because email service is not configured. Subject: ${subject}`,
    );
    return {
      message: `Email service not configured. Email to ${to} not sent.`,
    };
  }

  try {
    const result = await postmarkClient.sendEmail({
      To: to,
      From: fromEmail,
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
  } catch (error: any) {
    logger.error(`EmailService: Exception when sending email to ${to}:`, error);
    throw error;
  }
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
  const postmarkClient = getPostmarkClient();
  const fromEmail = config.email.from;

  if (!postmarkClient || !fromEmail) {
    logger.error(
      `EmailService: Cannot send bulk email to ${toList.join(
        ",",
      )} because email service is not configured. Subject: ${subject}`,
    );
    return {
      message: `Email service not configured. Bulk email not sent.`,
    };
  }

  try {
    const result = await postmarkClient.sendEmail({
      To: fromEmail, // send a copy to sender
      From: fromEmail,
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
  } catch (error: any) {
    logger.error(`EmailService: Exception when sending bulk email:`, error);
    throw error;
  }
}
